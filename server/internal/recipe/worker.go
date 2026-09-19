package recipe

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
)

type ImageGenerator interface {
	GenerateImage(context.Context, string, string) ([]byte, error)
}
type ImageStorage interface {
	SaveImage(context.Context, string, []byte) error
}

type Worker struct {
	Store     *Store
	Generator ImageGenerator
	Storage   ImageStorage
}

func (w *Worker) Run(ctx context.Context) {
	var wg sync.WaitGroup
	for range 3 {
		wg.Go(func() {
			for ctx.Err() == nil {
				worked, err := w.process(ctx)
				if err != nil && ctx.Err() == nil {
					slog.Error("image worker failed", "error", err)
				}
				if !worked || err != nil {
					select {
					case <-ctx.Done():
						return
					case <-time.After(time.Second):
					}
				}
			}
		})
	}
	wg.Wait()
}

// A row lock leases one durable job to one worker. On shutdown or a crash the
// transaction rolls back, making the pending job available on the next run.
// SKIP LOCKED also supports multiple application replicas without duplicate work.
func (w *Worker) process(ctx context.Context) (bool, error) {
	tx, err := w.Store.DB.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer tx.Rollback(context.Background())
	var id, title, description string
	err = tx.QueryRow(ctx, `SELECT j.id::text,r.title,r.description FROM cooking.image_generation_jobs j JOIN cooking.recipes r ON r.id=j.recipe_id WHERE j.status='PENDING' ORDER BY j.created_at,j.id LIMIT 1 FOR UPDATE OF j SKIP LOCKED`).Scan(&id, &title, &description)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	jobCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	data, err := w.Generator.GenerateImage(jobCtx, title, description)
	if err == nil {
		err = w.Storage.SaveImage(jobCtx, id, data)
	}
	status := "COMPLETED"
	var message *string
	if err != nil {
		if ctx.Err() != nil {
			return true, ctx.Err()
		}
		slog.Error("image generation failed", "job", id, "error", err)
		status = "FAILED"
		text := "A kép elkészítése nem sikerült."
		message = &text
	}
	if _, err := tx.Exec(ctx, "UPDATE cooking.image_generation_jobs SET status=$2,error=$3 WHERE id=$1", id, status, message); err != nil {
		return true, err
	}
	return true, tx.Commit(ctx)
}
