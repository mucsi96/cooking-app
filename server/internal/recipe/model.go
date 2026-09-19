package recipe

import (
	"errors"
	"math"
	"slices"
	"strings"
)

var ErrNotFound = errors.New("recipe not found")
var ErrInvalidImage = errors.New("image is not a completed candidate of this recipe")

type Ingredient struct {
	Name   string   `json:"name"`
	Amount *float64 `json:"amount"`
	Unit   *string  `json:"unit"`
}

type Content struct {
	Title       string       `json:"title"`
	Description string       `json:"description"`
	Category    string       `json:"category"`
	Servings    int          `json:"servings"`
	Ingredients []Ingredient `json:"ingredients"`
	Steps       []string     `json:"steps"`
}

type Recipe struct {
	ID string `json:"id"`
	Content
	ImageID *string `json:"imageId"`
}

type ListItem struct {
	ID       string  `json:"id"`
	Title    string  `json:"title"`
	Category string  `json:"category"`
	ImageID  *string `json:"imageId"`
}

type Candidate struct {
	ID     string  `json:"id"`
	Status string  `json:"status"`
	Error  *string `json:"error"`
}

func (r Content) Validate() error {
	if strings.TrimSpace(r.Title) == "" || strings.TrimSpace(r.Description) == "" || r.Servings < 1 || len(r.Ingredients) == 0 || len(r.Steps) == 0 {
		return errors.New("incomplete extracted recipe")
	}
	if !slices.Contains([]string{"Reggeli", "Leves", "Főétel", "Köret", "Saláta", "Desszert", "Sütemény", "Ital", "Egyéb"}, r.Category) {
		return errors.New("invalid recipe category")
	}
	for _, ingredient := range r.Ingredients {
		if strings.TrimSpace(ingredient.Name) == "" || (ingredient.Amount != nil && (*ingredient.Amount < 0 || math.IsNaN(*ingredient.Amount) || math.IsInf(*ingredient.Amount, 0))) {
			return errors.New("invalid ingredient")
		}
	}
	for _, step := range r.Steps {
		if strings.TrimSpace(step) == "" {
			return errors.New("empty recipe step")
		}
	}
	return nil
}
