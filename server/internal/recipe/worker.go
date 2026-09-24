package recipe

import (
	"context"
	"errors"
	"log/slog"
	"sync"
	"time"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type ImageGenerator interface {
	GenerateImage(context.Context, string, string, *string) ([]byte, error)
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
	worked := false
	err := w.Store.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var job struct {
			ID, Title, Description string
			ModelID                *string
		}
		err := tx.Table("cooking.image_generation_jobs AS j").Select("j.id, r.title, r.description, j.model_id").
			Joins("JOIN cooking.recipes AS r ON r.id = j.recipe_id").Where("j.status = ?", "PENDING").
			Order("j.created_at, j.id").
			Clauses(clause.Locking{Strength: "UPDATE", Table: clause.Table{Name: "j"}, Options: "SKIP LOCKED"}).
			Take(&job).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		if err != nil {
			return err
		}
		worked = true
		jobCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
		defer cancel()
		data, err := w.Generator.GenerateImage(jobCtx, job.Title, job.Description, job.ModelID)
		if err == nil {
			err = w.Storage.SaveImage(jobCtx, job.ID, data)
		}
		status := "COMPLETED"
		var message *string
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			slog.Error("image generation failed", "job", job.ID, "error", err)
			status = "FAILED"
			text := "A kép elkészítése nem sikerült."
			message = &text
		}
		// A map includes nil error values, unlike struct Updates which skips zeros.
		return tx.Model(&imageJobRecord{}).Where("id = ?", job.ID).
			Updates(map[string]any{"status": status, "error": message}).Error
	})
	return worked, storeError("process image job", err)
}
