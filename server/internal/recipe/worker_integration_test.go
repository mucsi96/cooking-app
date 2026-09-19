package recipe

import (
	"context"
	"errors"
	"os"
	"sync"
	"testing"
	"time"

	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/mucsi96/cooking-app/server/internal/database"
)

type generatorFunc func(context.Context, string, string) ([]byte, error)

func (f generatorFunc) GenerateImage(ctx context.Context, title, description string) ([]byte, error) {
	return f(ctx, title, description)
}

type storageFunc func(context.Context, string, []byte) error

func (f storageFunc) SaveImage(ctx context.Context, id string, data []byte) error {
	return f(ctx, id, data)
}

func TestWorkersClaimOnceAndRecoverInterruptedJobs(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := database.Open(ctx, config.Config{DatabaseURL: url})
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store := &Store{DB: pool}
	r, err := store.Create(ctx, Content{Title: "Leves", Description: "Finom", Category: "Leves", Servings: 4, Ingredients: []Ingredient{{Name: "só"}}, Steps: []string{"Főzd meg."}})
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Exec(context.Background(), "DELETE FROM cooking.recipes WHERE id=$1", r.ID)
	started := make(chan struct{})
	worker := Worker{Store: store, Generator: generatorFunc(func(ctx context.Context, _, _ string) ([]byte, error) {
		close(started)
		<-ctx.Done()
		return nil, ctx.Err()
	})}
	interrupted, interrupt := context.WithCancel(ctx)
	done := make(chan error, 1)
	go func() { _, err := worker.process(interrupted); done <- err }()
	select {
	case <-started:
	case <-ctx.Done():
		t.Fatal("worker did not start")
	}
	interrupt()
	if err := <-done; !errors.Is(err, context.Canceled) {
		t.Fatalf("interrupted job: %v", err)
	}
	jobs, err := store.Candidates(ctx, r.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, job := range jobs {
		if job.Status != "PENDING" {
			t.Fatalf("interruption consumed job: %+v", job)
		}
	}

	var mu sync.Mutex
	saved := map[string]int{}
	worker.Generator = generatorFunc(func(context.Context, string, string) ([]byte, error) { return []byte("image"), nil })
	worker.Storage = storageFunc(func(_ context.Context, id string, _ []byte) error {
		mu.Lock()
		defer mu.Unlock()
		saved[id]++
		return nil
	})
	var wg sync.WaitGroup
	for range 6 {
		wg.Go(func() {
			if _, err := worker.process(ctx); err != nil {
				t.Errorf("worker: %v", err)
			}
		})
	}
	wg.Wait()
	if len(saved) != 3 {
		t.Fatalf("expected three saved images, got %v", saved)
	}
	for id, count := range saved {
		if count != 1 {
			t.Errorf("job %s processed %d times", id, count)
		}
	}

	newJobs, err := store.Generate(ctx, r.ID)
	if err != nil {
		t.Fatal(err)
	}
	worker.Generator = generatorFunc(func(context.Context, string, string) ([]byte, error) { return nil, errors.New("provider unavailable") })
	for range 3 {
		if _, err := worker.process(ctx); err != nil {
			t.Fatal(err)
		}
	}
	for _, job := range newJobs {
		var status string
		if err := pool.QueryRow(ctx, "SELECT status FROM cooking.image_generation_jobs WHERE id=$1", job.ID).Scan(&status); err != nil || status != "FAILED" {
			t.Fatalf("terminal failure: %s %v", status, err)
		}
	}
}
