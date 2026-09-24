-- +goose Up
CREATE TABLE cooking.model_settings (
    id integer PRIMARY KEY CHECK (id = 1),
    value jsonb NOT NULL
);
ALTER TABLE cooking.image_generation_jobs ADD COLUMN model_id text;

-- +goose Down
ALTER TABLE cooking.image_generation_jobs DROP COLUMN model_id;
DROP TABLE cooking.model_settings;
