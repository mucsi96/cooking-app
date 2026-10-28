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

func insertCandidates(tx *gorm.DB, recipeID string, photo []byte) ([]Candidate, error) {
	settings, err := models.Read(tx)
	if err != nil {
		return nil, err
	}
	jobs := []imageJobRecord{}
	for _, image := range settings.Images {
		for range image.Count {
			id := image.ID
			jobs = append(jobs, imageJobRecord{ID: uuid.NewString(), RecipeID: recipeID, Status: "PENDING", ModelID: &id, SourcePhoto: photo})
		}
	}
	result := make([]Candidate, len(jobs))
	for i := range jobs {
		result[i] = Candidate{ID: jobs[i].ID, Status: jobs[i].Status}
	}
	if len(jobs) == 0 {
		return nil, ErrImagesDisabled
	}
	return result, tx.Create(&jobs).Error
}

// Create uses an explicit transaction for the parent and ordered children.
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
		return nil
	})
	return r.recipe(), storeError("create recipe", err)
}

// Update replaces ordered content atomically without touching images or queued jobs.
func (s *Store) Update(ctx context.Context, id string, content Content) error {
	return storeError("update recipe", s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&recipeRecord{}).Where("id = ?", id).Updates(map[string]any{
			"title": content.Title, "description": content.Description,
			"category": content.Category, "servings": content.Servings,
		})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrNotFound
		}
		if err := tx.Where("recipe_id = ?", id).Delete(&ingredientRecord{}).Error; err != nil {
			return err
		}
		if err := tx.Where("recipe_id = ?", id).Delete(&stepRecord{}).Error; err != nil {
			return err
		}
		ingredients := make([]ingredientRecord, len(content.Ingredients))
		for i, ingredient := range content.Ingredients {
			ingredients[i] = ingredientRecord{RecipeID: id, Position: i, Name: ingredient.Name, Amount: ingredient.Amount, Unit: ingredient.Unit}
		}
		if err := tx.CreateInBatches(&ingredients, 100).Error; err != nil {
			return err
		}
		steps := make([]stepRecord, len(content.Steps))
		for i, step := range content.Steps {
			steps[i] = stepRecord{RecipeID: id, Position: i, Step: step}
		}
		return tx.CreateInBatches(&steps, 100).Error
	}))
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

func (s *Store) Generate(ctx context.Context, id string, photo []byte) ([]Candidate, error) {
	if len(photo) == 0 {
		return nil, errors.New("thumbnail generation requires a photo")
	}
	var result []Candidate
	err := s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		locked := tx.Clauses(clause.Locking{Strength: "KEY SHARE"})
		if err := requireRecipe(locked, id); err != nil {
			return err
		}
		var err error
		result, err = insertCandidates(tx, id, photo)
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
