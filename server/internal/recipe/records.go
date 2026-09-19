package recipe

import "time"

// Persistence records are deliberately separate from API/domain models. Explicit
// table names and keys preserve the existing schema; gorm.Model would introduce
// numeric IDs, soft deletes and timestamps that these tables do not have.
type recipeRecord struct {
	ID          string `gorm:"type:uuid;primaryKey"`
	Title       string
	Description string
	Category    string
	Servings    int
	ImageID     *string `gorm:"type:uuid"`
	CreatedAt   time.Time
	Ingredients []ingredientRecord `gorm:"foreignKey:RecipeID;references:ID"`
	Steps       []stepRecord       `gorm:"foreignKey:RecipeID;references:ID"`
}

func (recipeRecord) TableName() string { return "cooking.recipes" }

type ingredientRecord struct {
	RecipeID string `gorm:"type:uuid;primaryKey"`
	Position int    `gorm:"primaryKey;autoIncrement:false"`
	Name     string
	Amount   *float64 `gorm:"type:numeric(10,2)"`
	Unit     *string
}

func (ingredientRecord) TableName() string { return "cooking.recipe_ingredients" }

type stepRecord struct {
	RecipeID string `gorm:"type:uuid;primaryKey"`
	Position int    `gorm:"primaryKey;autoIncrement:false"`
	Step     string
}

func (stepRecord) TableName() string { return "cooking.recipe_steps" }

type imageJobRecord struct {
	ID        string `gorm:"type:uuid;primaryKey"`
	RecipeID  string `gorm:"type:uuid"`
	Status    string
	Error     *string
	CreatedAt time.Time
}

func (imageJobRecord) TableName() string { return "cooking.image_generation_jobs" }

func (r recipeRecord) recipe() Recipe {
	ingredients := make([]Ingredient, len(r.Ingredients))
	for i, ingredient := range r.Ingredients {
		ingredients[i] = Ingredient{Name: ingredient.Name, Amount: ingredient.Amount, Unit: ingredient.Unit}
	}
	steps := make([]string, len(r.Steps))
	for i, step := range r.Steps {
		steps[i] = step.Step
	}
	return Recipe{ID: r.ID, ImageID: r.ImageID, Content: Content{
		Title: r.Title, Description: r.Description, Category: r.Category,
		Servings: r.Servings, Ingredients: ingredients, Steps: steps,
	}}
}
