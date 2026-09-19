# Cooking App — Development Guidelines

## General

- Prefer failing fast to silent fallbacks.
- Use immutable values and functional transformations where appropriate.
- All user-facing text is Hungarian; the UI uses the Material dark theme.
- Keep the architecture aligned with [skeleton-app](https://github.com/mucsi96/skeleton-app):
  Angular SPA, `/api/environment` bootstrap, Azure AD, PostgreSQL, mocked AI,
  Playwright, Podman and versioned Helm deployments.

## Go

- Use idiomatic Go: small packages, explicit constructors/dependencies, ordinary
  structs, context propagation, wrapped errors and `gofmt`.
- Do not recreate an annotation-based dependency-injection or ORM framework.
- HTTP routing and middleware use Gin. Persistence uses GORM's PostgreSQL driver
  over pgx and a shared `database/sql` connection pool.
- Keep persistence records separate from API models, with explicit schema-qualified
  table names and primary keys. Do not embed `gorm.Model` into legacy tables.
- Start queries with `WithContext(ctx)`; never cache mutable query chains. Use
  parameter placeholders for values and fixed, application-owned ordering/column names.
- Use transaction callbacks and only the provided transaction handle inside them.
  Preload ordered associations for details; project only needed columns for lists.
- Use targeted updates and explicit maps for zero/null values, check `RowsAffected`
  where meaningful, and translate `gorm.ErrRecordNotFound` into domain errors.
- Do not use `Save`, global updates, automatic association upserts or `AutoMigrate`.
  Goose SQL migrations are the only schema authority. Keep query parameters out of logs.
- Keep transactions around related writes; recipe creation and image job creation
  are atomic. Always close rows, response bodies, files and subprocess resources.
- Use `log/slog` structured logging. Do not log credentials or raw recipe photos.
- Interfaces belong with their consumers and should describe only the operations
  they need. Use a fixed worker pool rather than unbounded goroutines.
- New schema changes are versioned SQL files under
  `server/internal/database/migrations/`; never change an applied migration.
- The image queue uses `FOR UPDATE SKIP LOCKED`. Rollback returns interrupted
  work to the pending queue. Terminal errors become `FAILED`.
- Use the official Anthropic, OpenAI, Azure Identity and Key Vault SDKs.

## TypeScript / Angular

- Use `const`, readonly models, object/array spreads and map/filter/reduce.
- Prefer string literal unions over enums.
- Use standalone components, signals, signal inputs and HTTP resources for reads.
- Use Angular Material components and skeleton loaders for loading states.
- Follow `@mucsi96/angular-material-theme`'s documented button-color API: use
  `bt-color="primary|success|warn|error"` on `mat-flat-button`, `mat-raised-button`,
  `mat-fab` (including extended FABs), and `mat-mini-fab`, including anchor buttons.
  Use `[attr.bt-color]` for dynamic tones; no directive import is needed.
- Solid buttons default to primary. Use `error` for destructive actions, `warn`
  for caution, and `success` for positive outcomes. Material's legacy
  `color="warn"` means error/red, not the theme's orange `bt-color="warn"`.
- For an arbitrary solid-button color, set only `--bt-button-bg` without
  `bt-color`. Let the theme derive label contrast and hover colors. Do not override
  Material container/label/state-layer tokens, `--mat-sys-primary`, or button
  `background`, `color`, and `:hover` separately. Retain the intended button variant.
- The `bt-color` API does not cover text, outlined, icon or menu buttons. Use their
  documented Material APIs instead. Check the installed theme README when changing styles.
- Keep the shared authentication/interceptor/bootstrap conventions from skeleton-app.
  HTTP resources must still pass through the authentication and retry interceptors.
- Revoke object URLs on cleanup and cancel reads when the selected resource changes.

## Architecture

- `client/`: Angular 22, Material UI, MSAL production auth and local OIDC testing.
- `server/cmd/server/`: dependency wiring, startup and graceful shutdown.
- `server/internal/config/`: environment variables and Azure Key Vault.
- `server/internal/database/`: GORM, the shared pgx-backed SQL pool and embedded Goose migrations.
- `server/internal/recipe/`: domain model, SQL store, public page imports, workers.
- `server/internal/ai/`: recipe extraction and image generation SDK adapters.
- `server/internal/media/`: ffmpeg photo normalization and atomic WebP storage.
- `server/internal/httpapi/`: Gin routes, role/scope checks and health probes.
- Production API chart: `charts/go_app/` in the shared `k8s-helm-charts` project.
- `mock_anthropic_server/`, `mock_openai_server/`: Express mocks of provider APIs.
- `test/`: Playwright desktop/mobile E2E tests.
- `scripts/`, `.github/workflows/`: development, build, tests and deployment.

## Features and contracts

- Recipes are grouped by Hungarian category. Details rescale ingredient amounts
  when servings change and support printing.
- Text, public HTTP(S) URLs and recipe photos can be imported. Claude extracts
  structured Hungarian recipes. The text endpoint also serves the email pipeline.
- URL imports preserve JSON-LD, limit bytes/time/redirects, and validate the actual
  dialed IP address to prevent private network access and DNS rebinding.
- Photo uploads are limited to 15 MiB and normalized before extraction.
- Three candidate images are queued per import or generation request. Users can
  choose only completed images belonging to the recipe.
- Preserve API JSON field names and the existing `cooking` schema. Existing
  installations are adopted by Goose without dropping data or image files.

Protected routes require `api-access` scope plus `readRecipes` or `createRecipe`.
Authentication stays enabled during tests, using a mock OIDC provider.
`GET /api/environment` is public. See README for the complete route table.

## Configuration and deployment

- One Go binary/image works in every environment; configuration is runtime-only.
- Explicit environment variables override Key Vault values. See `server/.env.example`
  and README for variables and secrets. Never commit `server/.env`.
- Health endpoints are `/health/liveness` and
  `/health/readiness` on `MANAGEMENT_PORT`.
- Images live under `STORAGE_DIRECTORY/images/{uuid}.webp` on a persistent volume.
- API releases use the shared `mucsi96/go-app` chart (based on `spring-app`),
  preserving `cooking-pvc` and the workload identity service account. Client
  releases use the shared `mucsi96/client-app` chart. Keep `scripts/deploy.sh`
  aligned with the original shared-chart workflow and values.
- Release tags must point at the image's commit: `target_commitish: ${{ github.sha }}`.
  Component releases are skipped when their directory has not changed since its tag.

## Commands and tests

Enter `nix develop` for Go, Node, ffmpeg, Helm and Azure CLI. Install Podman through
the operating system. `scripts/install_dependencies.sh` installs project dependencies.

```bash
# From server/
go run ./cmd/server
go vet ./...
go build ./...

# From client/
npm start
npm run build

# From the repository root
scripts/pod_up.sh
scripts/pod_down.sh
scripts/dev_db_up.sh
scripts/dev_db_down.sh

# From test/
npm test
npx playwright test --ui
```

- Use Playwright E2E tests as the sole automated test suite, following skeleton-app.
  Exercise the running application with PostgreSQL and mock OIDC/AI services.
  Do not add Go unit/integration tests or a `go test` CI job.
- Playwright tests use user-facing roles/labels/text, not implementation selectors.
- Test port overrides: `TEST_BASE_URL`, `TEST_DB_PORT`, `TEST_ANTHROPIC_URL`,
  `TEST_OPENAI_URL`. Never reuse another project's database for tests.
