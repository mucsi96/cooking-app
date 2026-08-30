# Cooking App - Development Guidelines

## General Code Style

- Avoid fallbacks, prefer failing fast
- Prefer functional programming patterns
- Prefer immutable data structures

## Java Style

- Use Lombok annotations (@Data, @Builder, @RequiredArgsConstructor)
- Constructor injection (via @RequiredArgsConstructor)
- Use Stream API for collections
- Use records for DTOs/responses

## TypeScript Style

- Use `const` by default
- Prefer spread operator for object/array operations
- Use functional array methods (map, filter, reduce)
- Use string literals over enums

## Testing Style

- Write tests from user perspective
- Use role-based selectors (getByRole)
- Use semantic selectors (getByText, getByLabel)
- E2E tests with Playwright

## Angular Style

- Use Angular Material components
- Use signals and resources (not rxjs where possible)
- Use string literals over enums
- Standalone components

## Design

- Material UI dark theme
- Skeleton loaders for loading states
- All user-facing text is Hungarian

## Project Overview

Recipe collection application based on the patterns of
[skeleton-app](https://github.com/mucsi96/skeleton-app):

- Recipes are grouped by Hungarian category with AI-generated thumbnails
- The recipe details page rescales ingredient amounts when the serving
  count is adjusted
- Recipes are imported by pasting free text in any language (English,
  German, ...); Anthropic Claude extracts a structured recipe and
  translates it to Hungarian
- The same import endpoint accepts plain text over the API, which drives
  the email-based import pipeline
- Thumbnails are generated asynchronously (several candidates per recipe,
  following the [learn-language](https://github.com/mucsi96/learn-language)
  approach); the user picks their favorite

## Architecture

- **client/** - Angular SPA with Material UI, MSAL authentication
- **server/** - Spring Boot REST API with PostgreSQL, Spring AI (Anthropic) and the OpenAI image API
- **mock_anthropic_server/** - Express mock for the Claude API (recipe extraction, image scene descriptions)
- **mock_openai_server/** - Express mock for the OpenAI image generation API
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4, Java 21
- Angular 22
- PostgreSQL 17
- Spring AI (Anthropic) for structured recipe extraction
- openai-java for image generation, ffmpeg for webp thumbnails
- Azure AD (MSAL) authentication
- Azure Key Vault for secrets
- Traefik reverse proxy
- Docker multi-stage builds
- Playwright for E2E testing

## Development Commands

### Frontend
```bash
cd client && npm start        # Start dev server
cd client && npm run build    # Production build
```

### Backend
```bash
cd server && mvn spring-boot:run -Dspring-boot.run.profiles=local  # Start with local profile
```

### Podman Development
```bash
scripts/pod_up.sh             # Build images and start test pod
scripts/pod_down.sh           # Stop and clean up test pod
scripts/dev_db_up.sh          # Start development PostgreSQL database
scripts/dev_db_down.sh        # Stop development database
```

### Testing
```bash
cd test && npm test           # Run E2E tests
cd test && npx playwright test --ui  # Interactive test runner
```

## API Routes

- `GET /api/environment` - Client configuration (public)
- `GET /api/recipes` - Recipe list for the category overview (RecipeReader)
- `GET /api/recipes/{id}` - Recipe details (RecipeReader)
- `POST /api/recipes/import` - Import a recipe from free text in any language; also used by the email pipeline (RecipeCreator)
- `GET /api/recipes/{id}/images` - Thumbnail candidate statuses (RecipeReader)
- `POST /api/recipes/{id}/images` - Generate a new batch of thumbnail candidates (RecipeCreator)
- `PUT /api/recipes/{id}/image` - Pick the favorite thumbnail (RecipeCreator)
- `GET /api/images/{id}` - Serve a generated webp image (RecipeReader)

## Data Model

- **recipes** - Title, description, category, servings, chosen image, all in Hungarian
- **recipe_ingredients** - Ordered ingredients with numeric amount and unit
- **recipe_steps** - Ordered preparation steps
- **image_generation_jobs** - Async thumbnail candidate jobs (PENDING/COMPLETED/FAILED) per recipe

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with disabled auth and mock AI services

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag

### Secrets (Azure Key Vault)
- `claude-api-key` - Anthropic API key for recipe extraction and image descriptions
- `openai-api-key` - OpenAI API key for thumbnail generation
- `db-url`, `db-username`, `db-password` - PostgreSQL connection

### Storage
- Generated images are stored as webp files under `STORAGE_DIRECTORY`
  (mount a persistent volume in production)
