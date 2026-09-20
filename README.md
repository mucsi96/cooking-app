# Cooking App

Hungarian recipe collection with AI-powered import from text, public web pages,
and photos. Recipes are grouped by category, ingredient quantities scale with
servings, and users choose from asynchronously generated food photographs.

## Architecture

The application follows [skeleton-app](https://github.com/mucsi96/skeleton-app)
(reference reviewed at `b1ef96af3c6c406197aa2465946e429c3f750dd6`): an Angular
SPA bootstrapped from `/api/environment`, Azure AD authentication, PostgreSQL,
mock AI services, Playwright tests, Podman development and versioned container
releases deployed through Helm and Traefik.

| Component | Technology |
| --- | --- |
| Client | Angular 22, standalone components, signals and HTTP resources |
| UI | Angular Material and `@mucsi96/angular-material-theme`, Hungarian dark theme |
| API | Go 1.26, Gin, explicit dependency injection |
| Database | PostgreSQL 17, GORM with the pgx-backed PostgreSQL driver, Goose SQL migrations |
| Authentication | OIDC JWT validation with `go-oidc`; MSAL/Azure AD in the browser |
| Secrets | Official Azure Identity and Key Vault SDKs |
| AI | Official Anthropic and OpenAI Go SDKs |
| Images | Bounded PostgreSQL-backed worker pool, ffmpeg, persistent WebP files |
| Tests | Playwright desktop/mobile E2E against the full application stack |
| Deployment | Multi-stage Go/Alpine and Angular/nginx images, Helm, Traefik Gateway API |

The backend is organized by responsibility:

```text
server/cmd/server/          startup, dependency wiring, graceful shutdown
server/internal/config/    environment and Key Vault configuration
server/internal/database/  GORM, shared SQL pool and embedded SQL migrations
server/internal/recipe/    domain types, persistence, URL import, image workers
server/internal/ai/        Anthropic extraction and OpenAI image generation
server/internal/media/     photo normalization and atomic WebP storage
server/internal/httpapi/   Gin routes, bearer authentication, health probes
```

## Features and API

All protected endpoints require a signed, unexpired bearer token with the
configured issuer and audience, the `api-access` scope, and the indicated role.
Tests exercise the same authentication using a local OIDC provider.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/environment` | Public |
| GET | `/api/recipes` | `readRecipes` |
| GET | `/api/recipes/{id}` | `readRecipes` |
| POST | `/api/recipes/import` | `createRecipe` |
| POST | `/api/recipes/import/image` | `createRecipe` |
| GET | `/api/recipes/{id}/images` | `readRecipes` |
| POST | `/api/recipes/{id}/images` | `createRecipe` |
| PUT | `/api/recipes/{id}/image` | `createRecipe` |
| GET | `/api/images/{id}` | `readRecipes` |

Text import accepts `{"text":"recipe text or https://example.com/recipe"}`.
This is also the API used by the email import pipeline. Photo import accepts
multipart form field `image` (maximum 15 MiB). Photo bytes are checked and
normalized to JPEG before being sent to Claude. Image selection accepts
`{"imageId":"uuid"}` and returns HTTP 204.

URL imports retain page text and JSON-LD recipe metadata. They allow public
HTTP(S) addresses only, pin connections to validated IP addresses, validate
redirects, and enforce a 15-second timeout and 2 MiB download limit.

Each import creates three durable image jobs in the same transaction as the
recipe. Three workers claim jobs using PostgreSQL `FOR UPDATE SKIP LOCKED`,
generate a scene with Claude, render it with OpenAI and atomically write WebP
thumbnails. Failures are visible as `FAILED`; interrupted jobs remain `PENDING`
and resume after restart. Image generation does not hold up the import response.

### GORM persistence conventions

- Persistence records map explicitly to the existing `cooking` tables and UUID /
  composite primary keys, independently of API and domain models.
- Every operation propagates its context through `WithContext`. Related writes
  use transaction callbacks, with explicit batched inserts for ordered children.
- Recipe details preload ingredients and steps in position order. List queries
  select only their response columns and do not load associations.
- Updates target explicit columns; maps are used where null/zero values must be
  written. Record-not-found errors are mapped to domain errors, and conditional
  writes check affected rows. There are no implicit `Save` upserts or soft deletes.
- GORM and Goose share one bounded `database/sql` pool through pgx. SQL logging
  omits parameter values. Goose remains the only schema authority; startup does
  not call `AutoMigrate`.

The queue deliberately holds a row lock while generating an image so process
interruption rolls the job back to pending. Its three workers and five-minute
job deadline bound this exceptional long-running transaction; ordinary recipe
transactions contain database operations only.

## Development

Install Podman using your operating system, then enter the Nix shell:

```bash
nix develop
scripts/install_dependencies.sh
```

The shell supplies Go, gopls, Delve, Node, ffmpeg, jq, kubectl, Helm and Azure CLI.

### Full test stack

```bash
scripts/pod_up.sh
cd test
npm test
```

Open `http://localhost:8160`. `scripts/pod_down.sh` removes the test pod.
Set `SKIP_BUILD=1` to reuse already built images.

### Local API and frontend

```bash
scripts/dev_db_up.sh
cd server
# Set configuration using .env.example, or Azure Key Vault and az login.
set -a
source .env
set +a
go run ./cmd/server
```

In another terminal, run `npm start` from `client/`. The dev server on port 4260
proxies `/api` to port 8063. VS Code includes a Go debugger configuration using
`server/.env`. That file is ignored by Git.

### Checks

```bash
# From server/
go vet ./...
go build ./...

# From client/
npm run build

# From test/ with the test stack running
npm test
```

Following skeleton-app, Playwright E2E tests are the sole automated test suite.
They exercise the Angular client and Go API against PostgreSQL, a mock OIDC
provider and mock AI services in the test pod. CI builds the container images
and runs this suite before publishing. For an alternate test stack, Playwright
accepts `TEST_BASE_URL`, `TEST_DB_PORT`, `TEST_ANTHROPIC_URL` and `TEST_OPENAI_URL`.

## Runtime configuration

One Go binary and one container image serve all environments. Configuration is
read at startup. Explicit environment variables override Key Vault values.

| Environment variable | Key Vault secret / default |
| --- | --- |
| `AZURE_KEYVAULT_ENDPOINT` | Optional; enables loading the secrets below |
| `DB_URL` | `db-url`; PostgreSQL connection URL |
| `DB_USERNAME`, `DB_PASSWORD` | `db-username`, `db-password`; may also be in the URL |
| `TENANT_ID` | `tenant-id` |
| `API_CLIENT_ID` | `api-client-id`; expected access-token audience |
| `SPA_CLIENT_ID` | `spa-client-id`; browser application ID |
| `OIDC_ISSUER` | `https://login.microsoftonline.com/{TENANT_ID}/v2.0` |
| `MOCK_OAUTH2_SERVER_URI` | Optional local browser OIDC provider URL |
| `ANTHROPIC_API_KEY` | `claude-api-key` |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` (origin, without `/v1`) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | `openai-api-key` |
| `OPENAI_BASE_URL` | `https://api.openai.com` (origin, without `/v1`) |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-sunburst` |
| `STORAGE_DIRECTORY` | `./storage`; mount persistent storage in production |
| `SERVER_PORT` | 8063 locally, 8080 in the image |
| `MANAGEMENT_PORT` | 8162 locally, 8081 in the image; shared chart sets 8082 |
| `CLIENT_LOG_URL` | `client-log-url`; optional when Key Vault is disabled |
| `CLIENT_APP_NAME` | `cooking-client` |

Azure credentials use `DefaultAzureCredential`, supporting local Azure CLI login
and Kubernetes workload identity. Configuration failures abort startup.

Health checks live on the management listener:
`/health/liveness` and `/health/readiness`. Readiness checks
PostgreSQL. Logs are structured JSON via `log/slog`.

## Existing installations and deployment

The rewrite retains the `cooking` schema, UUIDs, table/column names and
`images/{id}.webp` storage layout. The first Goose migration adopts existing
tables without replacing records. Liquibase's bookkeeping tables are left
intact; subsequent migrations use Goose's own version table. Existing JDBC
`db-url` secrets are accepted, including `currentSchema` parameters.

Build the server with `podman build -t cooking-app-server server`; no profile
build argument is needed. Replace `SPRING_ACTUATOR_PORT` with `MANAGEMENT_PORT`
in custom deployment configurations. The shared `mucsi96/go-app` chart preserves the existing
release name, workload identity service account and `cooking-pvc` volume.

The GitHub pipeline runs Playwright E2E tests, publishes versioned images and
tags the exact built commit using `target_commitish`. `scripts/deploy.sh` uses
the shared `mucsi96/go-app` and `mucsi96/client-app` charts. The container's
`GOMEMLIMIT=256MiB` leaves room within the 768 MiB pod limit for ffmpeg processes.

The Go chart lives in
[`k8s-helm-charts/charts/go_app`](https://github.com/mucsi96/k8s-helm-charts/tree/main/charts/go_app)
and is based on its Spring chart, retaining the same environment, config-file,
PVC, identity and resource values. The initial published release is `go-app`
1.0.0. `scripts/deploy.sh` resolves its latest published version through the
shared Helm repository, just as it did for `spring-app`, and passes that version
explicitly to `helm upgrade`.

### Default ports

| Port | Service |
| --- | --- |
| 3060 / 3061 | Mock Anthropic / OpenAI |
| 4260 | Angular development server |
| 5460 / 5461 | Development / test PostgreSQL |
| 8060 | Mock OIDC provider |
| 8063 / 8064 | Local / test API |
| 8160 / 8161 | Test Traefik web / admin |
| 8162 | Local / test health checks |
