# Cooking App

Hungarian recipe collection with AI-powered import from text, public web pages,
and photos. Recipes are grouped by category, ingredient quantities scale with
servings, and users upload food photos to create AI-enhanced thumbnails.

## Architecture

The application follows [skeleton-app](https://github.com/mucsi96/skeleton-app):
a React SPA with build-time Faro configuration,
Azure AD authentication, PostgreSQL,
mock AI services, Playwright tests, Podman development, versioned API images and
tested static client artifacts deployed through Helm, Traefik and Azure Storage.

| Component | Technology |
| --- | --- |
| Client | React 19, Vite, strict TypeScript, TanStack Query and Zod |
| UI | `@mucsi96/react-ui`, CSS Modules, accessible Hungarian dark theme |
| API | Rust 1.99, Loco lifecycle/CLI, Axum controllers |
| Database | PostgreSQL 17, SeaORM and versioned SeaORM migrations |
| Authentication | RS256 JWT validation with rotating OIDC keys; stock oauth2-proxy ForwardAuth browser sessions |
| Secrets | Official Azure Identity and Key Vault SDKs |
| AI | Typed Anthropic/OpenAI HTTP clients with reqwest |
| Images | Bounded PostgreSQL-backed worker pool, ffmpeg, persistent WebP files |
| Tests | Playwright desktop/mobile E2E against the full application stack |
| Deployment | Native Rust/Debian API image with ffmpeg, Azure static client, Helm, Traefik Gateway API |

The backend is organized by responsibility:

```text
server/src/app.rs          Loco lifecycle, listeners, graceful shutdown
server/src/settings.rs     runtime environment and Key Vault configuration
server/src/controllers.rs typed API controllers
server/src/middleware/    bearer authentication and strict mutation Origin checks
server/src/models/        domain types, SeaORM persistence and model settings
server/src/services/      typed AI clients, URL import, media and durable workers
server/migration/         versioned, non-destructive SeaORM migrations
```

## Features and API

All protected endpoints require a signed, unexpired bearer token with the
configured issuer and audience, the `api-access` scope, and the indicated role.
Tests exercise the same authentication using a local OIDC provider.

The browser carries an HttpOnly session cookie. Platform-owned oauth2-proxy
forwards the Cooking API access token; the client has no OAuth library or token
storage. Browser mutations require the exact configured `BROWSER_ORIGIN`.
The client chart authenticates SPA document requests without rewriting their bodies.
Public configuration is compiled into the bundle. Build assets load directly from Azure
Blob with app-origin CORS; the chart owns nested document routing. nginx is only
the local/E2E static origin. Roboto fonts are bundled locally.
There is no auth service/interceptor, route guard or sign-in/out UI. An independent
read-only `/oauth2/userinfo` resource supplies the profile/settings menu.
The proxy renews sessions; a lost session re-enters login on the next page load.

| Method | Path | Role |
| --- | --- | --- |
| GET | `/api/recipes` | `readRecipes` |
| GET | `/api/recipes/{id}` | `readRecipes` |
| PUT | `/api/recipes/{id}` | `createRecipe` |
| POST | `/api/recipes/import` | `createRecipe` |
| POST | `/api/recipes/import/image` | `createRecipe` |
| GET | `/api/recipes/{id}/images` | `readRecipes` |
| POST | `/api/recipes/{id}/images` | `createRecipe` |
| PUT | `/api/recipes/{id}/image` | `createRecipe` |
| GET | `/api/images/{id}` | `readRecipes` |
| GET | `/api/models` | `createRecipe` |
| GET | `/api/settings/models` | `createRecipe` |
| PUT | `/api/settings/models` | `createRecipe` |

Text import accepts `{"text":"recipe text or https://example.com/recipe"}`.
Recipe editing accepts the complete content (`title`, `description`, `category`,
`servings`, ordered `ingredients` and `steps`) and returns HTTP 204. Updates are
atomic and preserve the selected image and image jobs. The **Recept szerkesztése**
dialog edits original quantities, independently of the displayed serving scale;
ingredients and preparation steps can be added, changed or removed.
Imports use the normal browser-authenticated UI endpoints and require the
configured browser Origin. There is no separate integration import endpoint.
Photo import accepts
multipart form field `image` (maximum 15 MiB). Photo bytes are checked and
normalized to JPEG before being sent to the selected data model. Image selection accepts
`{"imageId":"uuid"}` and returns HTTP 204.
Thumbnail uploads use `POST /api/recipes/{id}/images` with the same multipart
`image` field and 15 MiB limit. A source photo is required; an empty generation
request is rejected. The **Borítókép** dialog offers camera and photo-library
selection, preview/removal, upload retry and selection of completed thumbnails.

URL imports retain page text and JSON-LD recipe metadata. They allow public
HTTP(S) addresses only, pin connections to validated IP addresses, validate
redirects, and enforce a 15-second timeout and 2 MiB download limit.

Recipe imports no longer generate unrelated food images, including when importing
a photo of a written recipe. Upload a separate photo of the dish to create thumbnails.
Each thumbnail upload atomically queues the configured image jobs with their
normalized source JPEG. Three workers claim jobs using PostgreSQL
`FOR UPDATE SKIP LOCKED`, describe the supplied photo with the selected data model,
send both photo and editing instructions to OpenAI's image edits API, and atomically
write WebP thumbnails. Failures are visible as `FAILED`; interrupted jobs remain
`PENDING` with their input intact and resume after restart. Source bytes are cleared
from each job on completion or failure. Uploads return after queuing, without waiting
for AI processing. With all image models disabled, uploads return an actionable error.
Existing images remain selectable, and pre-upgrade pending text-only jobs still finish.

### Model settings

Open **Beállítások** from the user menu to select data models independently for
recipe extraction (text, URL and photo) and image descriptions. Image settings
specify counts per model/quality for each uploaded food photo; zero
disables that variant. Counts are limited to 10 per variant and 30 in total.
Settings are shared across users, require `createRecipe`, and persist in PostgreSQL.
Queued jobs retain their selected image model even when settings change.

The OpenAI catalog matches learn-language: `gpt-6-astra`, `gpt-6-sol`, `gpt-5.5`,
`gpt-5.6-sol`, `gpt-5.6-terra`, `gpt-5.6-luna`; images include `gpt-image-2`
(low/medium/high) and `gpt-image-2.5-sunburst` / `gpt-image-2.5-flare`
(low/medium/high/xhigh/max/auto). Anthropic data models are also available.
Provider account access is required for the selected models.

On first startup, `ANTHROPIC_MODEL` seeds both data selections and
`OPENAI_IMAGE_MODEL` seeds three medium-quality images. Subsequent startups
preserve saved settings. Existing queued jobs without a model use the configured
`OPENAI_IMAGE_MODEL`. Every data-model call uses native structured outputs:
OpenAI uses `response_format: json_schema` with `strict: true`; Anthropic uses
`output_config.format` with `type: json_schema`. Recipe extraction (text and photos)
and image descriptions each have a required JSON schema. Recipe fields include
nullable ingredient amounts/units and a fixed Hungarian category enum. Markdown
fences, prose, malformed JSON, refusals and truncated responses are rejected.
Domain validation enforces numeric bounds and nonempty recipe content before persistence.

### SeaORM persistence conventions

- Persistence records map explicitly to the existing `cooking` tables and UUID /
  composite primary keys, independently of API and domain models.
- Related writes use explicit transactions; dropped transactions roll back.
- Recipe details load ingredients and steps in position order. List queries
  select only their response columns and do not load associations.
- Updates target explicit columns including null/zero values. Missing records map
  to domain errors, and conditional writes check affected rows. There are no soft deletes.
- SeaORM owns one bounded PostgreSQL pool. Parameterized SQL handles projections
  and queue locking; query-value logging is disabled. Versioned migrations are
  the only schema authority; startup never recreates or truncates tables.

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

The shell supplies rustup, Node, ffmpeg, jq, kubectl, Helm and Azure CLI.
`server/rust-toolchain.toml` pins Rust, rustfmt and Clippy.

### Full test stack

```bash
scripts/pod_up.sh
cd test
npm test
```

Open `http://localhost:8160`. `scripts/pod_down.sh` removes the test pod.
Set `SKIP_BUILD=1` to reuse already built API/mock images and `client/dist`.

### Local API and frontend

```bash
scripts/dev_db_up.sh
cd server
# Set configuration using .env.example, or Azure Key Vault and az login.
set -a
source .env
set +a
cargo run -- start
```

In another terminal, run `npm start` from `client/`. The dev server on port 4260
proxies `/api` to port 8063. `server/.env` is ignored by Git.

The client requires Node 24 or newer. Routes are lazy React Router pages; TanStack
Query owns server state and cancels reads on navigation. Zod validates recipe,
model-setting and profile responses at API boundaries. Mutations invalidate the
affected queries. Dialog drafts stay local so failed saves can be retried without
losing edits. Shared `@mucsi96/react-ui` controls provide accessible dark-theme
interactions, with component styles colocated in CSS Modules.

Vite builds relative asset imports into `client/dist`. The existing preparation
script rewrites only HTML asset links for Blob hosting; API and telemetry calls
remain on the application origin. The frontend migration does not change backend
routes, database migrations, image storage or gateway authentication.

### Checks

```bash
# From server/
cargo fmt --all --check
cargo clippy --locked --all-targets -- -D warnings
cargo build --locked

# From client/
npm run lint
npm run typecheck
npm run build

# From test/ with the test stack running
npm test
```

Following skeleton-app, Playwright E2E tests are the sole automated test suite.
They exercise the React client and Rust API against PostgreSQL, a mock OIDC
provider and mock AI services in the test pod. CI builds the container images
and the static client artifact, and runs this suite before publishing.
For an alternate test stack, Playwright
accepts `TEST_BASE_URL`, `TEST_DB_PORT`, `TEST_ANTHROPIC_URL` and `TEST_OPENAI_URL`.

## Runtime configuration

One Rust binary and one container image serve all environments. Configuration is
read at startup. Explicit environment variables override Key Vault values.

| Environment variable | Key Vault secret / default |
| --- | --- |
| `AZURE_KEYVAULT_ENDPOINT` | Optional; enables loading the secrets below |
| `DB_URL` | `db-url`; PostgreSQL connection URL |
| `DB_USERNAME`, `DB_PASSWORD` | `db-username`, `db-password`; may also be in the URL |
| `TENANT_ID` | `tenant-id` |
| `API_CLIENT_ID` | `api-client-id`; expected access-token audience |
| `BROWSER_ORIGIN` | Required exact HTTP(S) browser origin, without a trailing slash |
| `OIDC_ISSUER` | `https://login.microsoftonline.com/{TENANT_ID}/v2.0` |
| `ANTHROPIC_API_KEY` | `claude-api-key` |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com` (origin, without `/v1`) |
| `ANTHROPIC_MODEL` | `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | `openai-api-key` |
| `OPENAI_BASE_URL` | `https://api.openai.com` (origin, without `/v1`) |
| `OPENAI_ALLOW_LOCAL_HTTP` | `false`; opt in to localhost/loopback HTTP mocks. The E2E pod enables it explicitly. |
| `OPENAI_IMAGE_MODEL` | `gpt-image-2.5-sunburst` |
| `STORAGE_DIRECTORY` | `./storage`; mount persistent storage in production |
| `SERVER_PORT` | 8063 locally, 8080 in the image |
| `MANAGEMENT_PORT` | 8162 locally, 8081 in the image; shared chart sets 8082 |

Azure credentials use `WorkloadIdentityCredential` when a federated token file is
configured, and `AzureCliCredential` for local `az login`. Explicit `.env` values
also work locally. Kubernetes retains its federated service account.
Configuration failures abort startup.

Health checks live on the management listener:
`/health/liveness` and `/health/readiness`. Readiness checks
PostgreSQL. Logs are structured JSON via tracing. The container runs the native
Loco `start --no-banner` command; `--healthcheck` probes readiness without curl.

## Existing installations and deployment

Publish the shared ForwardAuth/app charts and provision the platform-owned
`cooking-oauth2-proxy` release before deploying these builds. The deploy script
checks that release and middleware support, sets the production browser origin,
and reads `forward-auth-config` from the app Azure Key Vault. It contains the
release name and the shared `.auth` descriptor, passed to both application charts.
Faro's app name and `/_telemetry/collect` path are compiled into the bundle;
the browser resolves the collector URL against the app origin, not Blob storage.
There is no global config, bootstrap marker or runtime configuration fetch.
The deploy script pins published go-app 8.0.0 and static-client-app 5.0.0.
The client chart owns document authentication and SPA routing. Deployment omits
`runtimeConfig`; `--reset-values` removes its former response-body middleware.
The app tests use mock authentication: Playwright supplies profile data and
injects a mock-issued bearer token into browser API requests. The mock provider's
issues signed access tokens. Backend JWT validation
and Origin checks stay enabled. Test pods run the app, database, mock OIDC/AI
services and routing, without oauth2-proxy or Redis. Playwright targets `http://localhost:8160`.

The rewrite retains the `cooking` schema, UUIDs, table/column names and
`images/{id}.webp` storage layout. The SeaORM baseline adopts existing
tables and missing additive columns without replacing records. Liquibase and
Goose bookkeeping tables are left intact; subsequent migrations use SeaORM's
version table. Historical Goose SQL remains archived and is not executed. Existing JDBC
`db-url` secrets are accepted, including `currentSchema` parameters.

Build the server with `podman build -t cooking-app-server server`; no profile
build argument is needed. Replace `SPRING_ACTUATOR_PORT` with `MANAGEMENT_PORT`
in custom deployment configurations. The shared `mucsi96/go-app` chart preserves the existing
release name, workload identity service account and `cooking-pvc` volume.

The GitHub pipeline runs Playwright E2E tests, publishes numbered GHCR images and
creates component releases when source changes, tagging the built commit using
`target_commitish`. `scripts/deploy.sh` uses
the shared `mucsi96/go-app` and `mucsi96/static-client-app` charts. The existing
768 MiB pod limit accommodates the native server and ffmpeg processes.

The Go chart lives in
[`k8s-helm-charts/charts/go_app`](https://github.com/mucsi96/k8s-helm-charts/tree/main/charts/go_app)
and is based on its Spring chart, retaining the same environment, config-file,
PVC, identity and resource values. Chart versions are explicit published pins.

### Static client hosting

Terraform's `setup_cooking_app` requires `client_storage_account_name` and
publishes `client-storage-config` (`account_name`, `hostname`, `assets_base_url`).
Provision this module change and the app's external-origin/TraefikService
permissions before merging the application migration. Existing API identities,
database schema and `cooking-pvc` remain in place. Recipe photographs still use
the protected `/api/images/...` endpoints; public Blob storage holds build assets only.

CI lints, type-checks and builds React/Vite with Node/npm and tests that same `client-static` artifact.
`scripts/prepare-client.mjs` rewrites HTML links to anonymous Blob asset URLs
without changing bundle bytes or the `/` document base. Manifest navigation stays
on the app hostname. Official `azure/login` and `azure/cli` actions use the
existing federated identity, scoped separately to `$web` and `assets`, to
empty `$web` and `assets`, then upload the latest assets first and index last.
Downtime is intentional; old bundles are removed. Assets cache for one year and
index uses `no-store`. The client release attaches `client-static.tar.gz`.

`cooking-client` retains its Helm release and document route, but creates no
client Deployment. The gateway authenticates documents, strips credentials before
the verified HTTPS origin request, and serves the document unchanged with no-store
headers. Blob CORS permits the app origin; APIs and Faro remain same-origin.
The storage website and assets contain public build content, not protected data.

This is the same hosting/configuration contract as Skeleton and Observatory.
All use host-only `__Host-session` cookies and the same `.auth` descriptor for
client/API charts. Backend mutation protection remains stack-specific: Cooking
uses strict Origin checks, Skeleton uses its own cookie/header CSRF contract, and Observatory
has a read-only JWT-protected API. The chart fixes `no-referrer` and `nosniff`
document headers; Observatory additionally supplies its strict CSP.

### Default ports

| Port | Service |
| --- | --- |
| 3060 / 3061 | Mock Anthropic / OpenAI |
| 4260 | Vite development server |
| 5460 / 5461 | Development / test PostgreSQL |
| 8060 | Mock OIDC provider |
| 8063 / 8064 | Local / test API |
| 8160 / 8161 | Test Traefik web / admin |
| 8162 | Local / test health checks |
