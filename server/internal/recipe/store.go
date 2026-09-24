package recipe

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/mucsi96/cooking-app/server/internal/models"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Store struct{ db *gorm.DB }

func NewStore(db *gorm.DB) *Store { return &Store{db: db} }

func storeError(operation string, err error) error {
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("%s: %w", operation, err)
	}
	return nil
}

func (s *Store) List(ctx context.Context) ([]ListItem, error) {
	result := []ListItem{}
	err := s.db.WithContext(ctx).Model(&recipeRecord{}).
		Select("id", "title", "category", "image_id").Order("created_at, id").Find(&result).Error
	return result, storeError("list recipes", err)
}

func (s *Store) Get(ctx context.Context, id string) (Recipe, error) {
	var record recipeRecord
	ordered := func(db *gorm.DB) *gorm.DB { return db.Order("position") }
	err := s.db.WithContext(ctx).Where("id = ?", id).
		Preload("Ingredients", ordered).Preload("Steps", ordered).Take(&record).Error
	return record.recipe(), storeError("get recipe", err)
}

func insertCandidates(tx *gorm.DB, recipeID string) ([]Candidate, error) {
	settings, err := models.Read(tx)
	if err != nil {
		return nil, err
	}
	jobs := []imageJobRecord{}
	for _, image := range settings.Images {
		for range image.Count {
			id := image.ID
			jobs = append(jobs, imageJobRecord{ID: uuid.NewString(), RecipeID: recipeID, Status: "PENDING", ModelID: &id})
		}
	}
	result := make([]Candidate, len(jobs))
	for i := range jobs {
		result[i] = Candidate{ID: jobs[i].ID, Status: jobs[i].Status}
	}
	if len(jobs) == 0 {
		return result, nil
	}
	return result, tx.Create(&jobs).Error
}

// Create uses an explicit transaction for the parent, ordered children and queue.
// Associations are inserted explicitly, avoiding GORM's implicit association upserts.
func (s *Store) Create(ctx context.Context, content Content) (Recipe, error) {
	r := recipeRecord{ID: uuid.NewString(), Title: content.Title, Description: content.Description,
		Category: content.Category, Servings: content.Servings}
	r.Ingredients = make([]ingredientRecord, len(content.Ingredients))
	for position, ingredient := range content.Ingredients {
		r.Ingredients[position] = ingredientRecord{RecipeID: r.ID, Position: position,
			Name: ingredient.Name, Amount: ingredient.Amount, Unit: ingredient.Unit}
	}
	r.Steps = make([]stepRecord, len(content.Steps))
	for position, step := range content.Steps {
		r.Steps[position] = stepRecord{RecipeID: r.ID, Position: position, Step: step}
	}
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if err := tx.Omit(clause.Associations).Create(&r).Error; err != nil {
			return err
		}
		if len(r.Ingredients) > 0 {
			if err := tx.CreateInBatches(&r.Ingredients, 100).Error; err != nil {
				return err
			}
		}
		if len(r.Steps) > 0 {
			if err := tx.CreateInBatches(&r.Steps, 100).Error; err != nil {
				return err
			}
		}
		_, err := insertCandidates(tx, r.ID)
		return err
	})
	return r.recipe(), storeError("create recipe", err)
}

// requireRecipe checks existence without loading ingredient and step associations.
func requireRecipe(db *gorm.DB, id string) error {
	var record recipeRecord
	return storeError("find recipe", db.Select("id").Where("id = ?", id).Take(&record).Error)
}

func (s *Store) Candidates(ctx context.Context, id string) ([]Candidate, error) {
	db := s.db.WithContext(ctx)
	if err := requireRecipe(db, id); err != nil {
		return nil, err
	}
	result := []Candidate{}
	err := db.Model(&imageJobRecord{}).Select("id", "status", "error").
		Where("recipe_id = ?", id).Order("created_at, id").Find(&result).Error
	return result, storeError("list image candidates", err)
}

func (s *Store) Generate(ctx context.Context, id string) ([]Candidate, error) {
	var result []Candidate
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		locked := tx.Clauses(clause.Locking{Strength: "KEY SHARE"})
		if err := requireRecipe(locked, id); err != nil {
			return err
		}
		var err error
		result, err = insertCandidates(tx, id)
		return err
	})
	return result, storeError("queue image candidates", err)
}

func (s *Store) SelectImage(ctx context.Context, id, imageID string) error {
	db := s.db.WithContext(ctx)
	if err := requireRecipe(db, id); err != nil {
		return err
	}
	completed := db.Model(&imageJobRecord{}).Select("1").
		Where("id = ? AND recipe_id = ? AND status = ?", imageID, id, "COMPLETED")
	result := db.Model(&recipeRecord{}).Where("id = ?", id).
		Where("EXISTS (?)", completed).Update("image_id", imageID)
	if result.Error != nil {
		return storeError("select recipe image", result.Error)
	}
	if result.RowsAffected == 0 {
		return ErrInvalidImage
	}
	return nil
}
