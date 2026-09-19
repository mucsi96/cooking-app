package recipe_test

import (
	"context"
	"errors"
	"os"
	"reflect"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/mucsi96/cooking-app/server/internal/config"
	"github.com/mucsi96/cooking-app/server/internal/database"
	"github.com/mucsi96/cooking-app/server/internal/recipe"
)

func TestRecipePersistence(t *testing.T) {
	url := os.Getenv("TEST_DATABASE_URL")
	if url == "" {
		t.Skip("set TEST_DATABASE_URL to an isolated PostgreSQL database")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	c := config.Config{DatabaseURL: url}
	db, err := database.Open(ctx, c)
	if err != nil {
		t.Fatal(err)
	}
	pool, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer pool.Close()
	store := recipe.NewStore(db)
	amount := 500.0
	unit := "g"
	content := recipe.Content{Title: "Gulyás", Description: "Magyar leves", Category: "Leves", Servings: 4, Ingredients: []recipe.Ingredient{{Name: "hús", Amount: &amount, Unit: &unit}, {Name: "só"}}, Steps: []string{"Pirítsd meg.", "Főzd puhára."}}
	zero, fraction := 0.0, 0.25
	content.Ingredients = append(content.Ingredients, recipe.Ingredient{Name: "kihagyott", Amount: &zero}, recipe.Ingredient{Name: "bors", Amount: &fraction})
	created, err := store.Create(ctx, content)
	if err != nil {
		t.Fatal(err)
	}
	defer pool.ExecContext(context.Background(), "DELETE FROM cooking.recipes WHERE id=$1", created.ID)
	loaded, err := store.Get(ctx, created.ID)
	if err != nil || !reflect.DeepEqual(loaded.Content, content) {
		t.Fatalf("recipe did not round-trip: %+v %v", loaded, err)
	}
	jobs, err := store.Candidates(ctx, created.ID)
	if err != nil || len(jobs) != 3 {
		t.Fatalf("expected three durable candidates: %v %v", jobs, err)
	}
	if err := store.SelectImage(ctx, created.ID, jobs[0].ID); !errors.Is(err, recipe.ErrInvalidImage) {
		t.Fatalf("selected pending image: %v", err)
	}
	if _, err := pool.ExecContext(ctx, "UPDATE cooking.image_generation_jobs SET status='COMPLETED' WHERE id=$1", jobs[0].ID); err != nil {
		t.Fatal(err)
	}
	if err := store.SelectImage(ctx, created.ID, jobs[0].ID); err != nil {
		t.Fatal(err)
	}
	other, err := store.Create(ctx, recipe.Content{Title: "Másik recept", Category: "Egyéb", Servings: 1})
	if err != nil {
		t.Fatal(err)
	}
	defer pool.ExecContext(context.Background(), "DELETE FROM cooking.recipes WHERE id=$1", other.ID)
	if err := store.SelectImage(ctx, other.ID, jobs[0].ID); !errors.Is(err, recipe.ErrInvalidImage) {
		t.Fatalf("selected another recipe's image: %v", err)
	}
	empty, err := store.Get(ctx, other.ID)
	if err != nil || empty.Ingredients == nil || empty.Steps == nil {
		t.Fatalf("empty associations must be JSON arrays: %+v %v", empty, err)
	}
	// Reusing the shared GORM handle concurrently must not leak WHERE conditions.
	var wg sync.WaitGroup
	for range 10 {
		for _, id := range []string{created.ID, other.ID} {
			wg.Go(func() {
				r, err := store.Get(ctx, id)
				if err != nil || r.ID != id {
					t.Errorf("concurrent read %s: %s %v", id, r.ID, err)
				}
				candidates, err := store.Candidates(ctx, id)
				if err != nil || len(candidates) != 3 {
					t.Errorf("concurrent candidates %s: %v %v", id, candidates, err)
				}
			})
		}
	}
	wg.Wait()
	canceled, stop := context.WithCancel(ctx)
	stop()
	if _, err := store.Get(canceled, created.ID); !errors.Is(err, context.Canceled) {
		t.Fatalf("query ignored cancellation: %v", err)
	}
	if _, err := store.Generate(canceled, created.ID); !errors.Is(err, context.Canceled) {
		t.Fatalf("transaction ignored cancellation: %v", err)
	}
	// Starting a second instance must preserve all existing data and image choices.
	second, err := database.Open(ctx, c)
	if err != nil {
		t.Fatal(err)
	}
	secondPool, err := second.DB()
	if err != nil {
		t.Fatal(err)
	}
	defer secondPool.Close()
	loaded, err = recipe.NewStore(second).Get(ctx, created.ID)
	if err != nil || loaded.ImageID == nil || *loaded.ImageID != jobs[0].ID {
		t.Fatalf("migration changed existing data: %+v %v", loaded, err)
	}
	if _, err := store.Get(ctx, uuid.NewString()); !errors.Is(err, recipe.ErrNotFound) {
		t.Fatalf("missing recipe: %v", err)
	}
	if _, err := store.Generate(ctx, created.ID); err != nil {
		t.Fatal(err)
	}
	jobs, err = store.Candidates(ctx, created.ID)
	if err != nil || len(jobs) != 6 {
		t.Fatalf("regeneration did not append candidates: %v %v", jobs, err)
	}
	// A database error in an ingredient must roll back the parent recipe and jobs.
	tooLarge := 1e12
	content.Title = "Must roll back"
	content.Ingredients = []recipe.Ingredient{{Name: "hús", Amount: &tooLarge}}
	if _, err := store.Create(ctx, content); err == nil {
		t.Fatal("expected numeric overflow")
	}
	var count int
	if err := pool.QueryRowContext(ctx, "SELECT count(*) FROM cooking.recipes WHERE title='Must roll back'").Scan(&count); err != nil || count != 0 {
		t.Fatalf("partial recipe was persisted: %d %v", count, err)
	}
}
