-- +goose Up
-- IF NOT EXISTS adopts the existing Liquibase schema without modifying records.
CREATE SCHEMA IF NOT EXISTS cooking;
CREATE TABLE IF NOT EXISTS cooking.recipes (
    id uuid PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    category text NOT NULL,
    servings integer NOT NULL,
    image_id uuid,
    created_at timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS cooking.recipe_ingredients (
    recipe_id uuid NOT NULL REFERENCES cooking.recipes(id) ON DELETE CASCADE,
    position integer NOT NULL,
    name text NOT NULL,
    amount numeric(10,2),
    unit text,
    PRIMARY KEY (recipe_id, position)
);
CREATE TABLE IF NOT EXISTS cooking.recipe_steps (
    recipe_id uuid NOT NULL REFERENCES cooking.recipes(id) ON DELETE CASCADE,
    position integer NOT NULL,
    step text NOT NULL,
    PRIMARY KEY (recipe_id, position)
);
CREATE TABLE IF NOT EXISTS cooking.image_generation_jobs (
    id uuid PRIMARY KEY,
    recipe_id uuid NOT NULL REFERENCES cooking.recipes(id) ON DELETE CASCADE,
    status text NOT NULL,
    error text,
    created_at timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS image_generation_jobs_recipe_idx ON cooking.image_generation_jobs(recipe_id, created_at);
