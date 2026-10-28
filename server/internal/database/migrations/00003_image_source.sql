-- +goose Up
-- Keep the normalized input with each pending job so retries survive restarts.
-- Workers clear these bytes when the job reaches a terminal state.
ALTER TABLE cooking.image_generation_jobs ADD COLUMN source_photo bytea;
