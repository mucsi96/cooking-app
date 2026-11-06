# Historical Goose migrations

These applied SQL files are retained unchanged as the legacy schema history and
as fixtures for the Playwright upgrade test. The Rust server does not execute
them. New migrations belong in `server/migration/` and run through SeaORM.
