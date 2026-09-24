package models

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type DataModel struct {
	ID       string `json:"id"`
	Provider string `json:"provider"`
}
type ImageModel struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Model   string `json:"model"`
	Quality string `json:"quality"`
}
type ImageSetting struct {
	ID    string `json:"id"`
	Count int    `json:"count"`
}
type Settings struct {
	Extraction string         `json:"extraction"`
	Scene      string         `json:"scene"`
	Images     []ImageSetting `json:"images"`
}
type Catalog struct {
	Data   []DataModel  `json:"data"`
	Images []ImageModel `json:"images"`
}
type record struct {
	ID    int    `gorm:"primaryKey;autoIncrement:false"`
	Value string `gorm:"type:jsonb"`
}

func (record) TableName() string { return "cooking.model_settings" }

type Store struct {
	db      *gorm.DB
	Catalog Catalog
}

var ErrInvalid = errors.New("invalid model settings")

func New(ctx context.Context, db *gorm.DB, textModel, imageModel string) (*Store, error) {
	catalog := Catalog{Data: []DataModel{}, Images: []ImageModel{}}
	for _, id := range []string{"gpt-6-astra", "gpt-6-sol", "gpt-5.5", "gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"} {
		catalog.Data = append(catalog.Data, DataModel{id, "openai"})
	}
	for _, id := range []string{"claude-sonnet-4-5", "claude-sonnet-5", "claude-haiku-4-5", "claude-opus-4-8", "claude-opus-5-5"} {
		catalog.Data = append(catalog.Data, DataModel{id, "anthropic"})
	}
	found := false
	for _, model := range catalog.Data {
		found = found || model.ID == textModel
	}
	if !found {
		catalog.Data = append(catalog.Data, DataModel{textModel, "anthropic"})
	}
	for _, model := range []string{"gpt-image-2", "gpt-image-2.5-sunburst", "gpt-image-2.5-flare"} {
		qualities := []string{"low", "medium", "high"}
		if model != "gpt-image-2" {
			qualities = append(qualities, "xhigh", "max", "auto")
		}
		for _, quality := range qualities {
			catalog.Images = append(catalog.Images, ImageModel{model + "-" + quality, model + " (" + quality + ")", model, quality})
		}
	}
	found = false
	for _, model := range catalog.Images {
		found = found || model.ID == imageModel+"-medium"
	}
	if !found {
		catalog.Images = append(catalog.Images, ImageModel{imageModel + "-medium", imageModel + " (medium)", imageModel, "medium"})
	}
	s := &Store{db: db, Catalog: catalog}
	initial := Settings{Extraction: textModel, Scene: textModel, Images: []ImageSetting{{ID: imageModel + "-medium", Count: 3}}}
	value, err := json.Marshal(initial)
	if err != nil {
		return nil, err
	}
	err = db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).Create(&record{ID: 1, Value: string(value)}).Error
	return s, err
}
func (s *Store) Data(id string) (DataModel, bool) {
	for _, model := range s.Catalog.Data {
		if model.ID == id {
			return model, true
		}
	}
	return DataModel{}, false
}
func (s *Store) Image(id string) (ImageModel, bool) {
	for _, model := range s.Catalog.Images {
		if model.ID == id {
			return model, true
		}
	}
	return ImageModel{}, false
}
func Read(db *gorm.DB) (Settings, error) {
	var row record
	if err := db.Where("id = ?", 1).Take(&row).Error; err != nil {
		return Settings{}, fmt.Errorf("read model settings: %w", err)
	}
	var settings Settings
	err := json.Unmarshal([]byte(row.Value), &settings)
	return settings, err
}
func (s *Store) Get(ctx context.Context) (Settings, error) { return Read(s.db.WithContext(ctx)) }
func (s *Store) Put(ctx context.Context, value Settings) error {
	if value.Images == nil {
		return ErrInvalid
	}
	if _, ok := s.Data(value.Extraction); !ok {
		return ErrInvalid
	}
	if _, ok := s.Data(value.Scene); !ok {
		return ErrInvalid
	}
	seen := map[string]bool{}
	total := 0
	for _, image := range value.Images {
		if _, ok := s.Image(image.ID); !ok || seen[image.ID] || image.Count < 0 || image.Count > 10 {
			return ErrInvalid
		}
		seen[image.ID] = true
		total += image.Count
	}
	if total > 30 {
		return ErrInvalid
	}
	data, err := json.Marshal(value)
	if err != nil {
		return err
	}
	result := s.db.WithContext(ctx).Model(&record{}).Where("id = ?", 1).Update("value", string(data))
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected != 1 {
		return errors.New("model settings missing")
	}
	return nil
}
