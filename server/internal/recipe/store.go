package recipe

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ DB *pgxpool.Pool }

func (s *Store) List(ctx context.Context) ([]ListItem, error) {
	rows, err := s.DB.Query(ctx, "SELECT id::text, title, category, image_id::text FROM cooking.recipes ORDER BY created_at, id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []ListItem{}
	for rows.Next() {
		var item ListItem
		if err := rows.Scan(&item.ID, &item.Title, &item.Category, &item.ImageID); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (s *Store) Get(ctx context.Context, id string) (Recipe, error) {
	r := Recipe{Content: Content{Ingredients: []Ingredient{}, Steps: []string{}}}
	err := s.DB.QueryRow(ctx, `SELECT id::text, title, description, category, servings, image_id::text FROM cooking.recipes WHERE id=$1`, id).Scan(&r.ID, &r.Title, &r.Description, &r.Category, &r.Servings, &r.ImageID)
	if errors.Is(err, pgx.ErrNoRows) {
		return r, ErrNotFound
	}
	if err != nil {
		return r, err
	}
	rows, err := s.DB.Query(ctx, "SELECT name, amount::float8, unit FROM cooking.recipe_ingredients WHERE recipe_id=$1 ORDER BY position", id)
	if err != nil {
		return r, err
	}
	defer rows.Close()
	for rows.Next() {
		var ingredient Ingredient
		if err := rows.Scan(&ingredient.Name, &ingredient.Amount, &ingredient.Unit); err != nil {
			return r, err
		}
		r.Ingredients = append(r.Ingredients, ingredient)
	}
	if err := rows.Err(); err != nil {
		return r, err
	}
	rows.Close()
	steps, err := s.DB.Query(ctx, "SELECT step FROM cooking.recipe_steps WHERE recipe_id=$1 ORDER BY position", id)
	if err != nil {
		return r, err
	}
	defer steps.Close()
	for steps.Next() {
		var step string
		if err := steps.Scan(&step); err != nil {
			return r, err
		}
		r.Steps = append(r.Steps, step)
	}
	return r, steps.Err()
}

func insertCandidates(ctx context.Context, tx pgx.Tx, recipeID string) ([]Candidate, error) {
	result := make([]Candidate, 0, 3)
	for range 3 {
		candidate := Candidate{ID: uuid.NewString(), Status: "PENDING"}
		if _, err := tx.Exec(ctx, "INSERT INTO cooking.image_generation_jobs(id,recipe_id,status,created_at) VALUES($1,$2,'PENDING',now())", candidate.ID, recipeID); err != nil {
			return nil, err
		}
		result = append(result, candidate)
	}
	return result, nil
}

// Create persists the recipe and its durable image queue in one transaction.
func (s *Store) Create(ctx context.Context, content Content) (Recipe, error) {
	r := Recipe{ID: uuid.NewString(), Content: content}
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return r, err
	}
	defer tx.Rollback(ctx)
	if _, err := tx.Exec(ctx, "INSERT INTO cooking.recipes(id,title,description,category,servings,created_at) VALUES($1,$2,$3,$4,$5,now())", r.ID, r.Title, r.Description, r.Category, r.Servings); err != nil {
		return r, err
	}
	for position, ingredient := range r.Ingredients {
		if _, err := tx.Exec(ctx, "INSERT INTO cooking.recipe_ingredients(recipe_id,position,name,amount,unit) VALUES($1,$2,$3,$4,$5)", r.ID, position, ingredient.Name, ingredient.Amount, ingredient.Unit); err != nil {
			return r, err
		}
	}
	for position, step := range r.Steps {
		if _, err := tx.Exec(ctx, "INSERT INTO cooking.recipe_steps(recipe_id,position,step) VALUES($1,$2,$3)", r.ID, position, step); err != nil {
			return r, err
		}
	}
	if _, err := insertCandidates(ctx, tx, r.ID); err != nil {
		return r, err
	}
	return r, tx.Commit(ctx)
}

func (s *Store) Candidates(ctx context.Context, id string) ([]Candidate, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	rows, err := s.DB.Query(ctx, "SELECT id::text,status,error FROM cooking.image_generation_jobs WHERE recipe_id=$1 ORDER BY created_at,id", id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []Candidate{}
	for rows.Next() {
		var candidate Candidate
		if err := rows.Scan(&candidate.ID, &candidate.Status, &candidate.Error); err != nil {
			return nil, err
		}
		result = append(result, candidate)
	}
	return result, rows.Err()
}

func (s *Store) Generate(ctx context.Context, id string) ([]Candidate, error) {
	tx, err := s.DB.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var exists string
	if err := tx.QueryRow(ctx, "SELECT id::text FROM cooking.recipes WHERE id=$1 FOR KEY SHARE", id).Scan(&exists); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	result, err := insertCandidates(ctx, tx, id)
	if err != nil {
		return nil, err
	}
	return result, tx.Commit(ctx)
}

func (s *Store) SelectImage(ctx context.Context, id, imageID string) error {
	if _, err := s.Get(ctx, id); err != nil {
		return err
	}
	result, err := s.DB.Exec(ctx, `UPDATE cooking.recipes SET image_id=$2 WHERE id=$1 AND EXISTS(SELECT 1 FROM cooking.image_generation_jobs WHERE id=$2 AND recipe_id=$1 AND status='COMPLETED')`, id, imageID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return ErrInvalidImage
	}
	return nil
}
