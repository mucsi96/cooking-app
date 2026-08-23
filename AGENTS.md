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
- Cooking loaders for loading states

## Project Overview

Reference application demonstrating patterns for:
- CI/CD pipeline (GitHub Actions)
- Deployment (Docker images published to registry)
- Client (Angular 21 with Material UI)
- Server (Spring Boot 4 with Java 21)
- Authentication (Azure AD / MSAL)
- Configuration (Azure Key Vault, Spring profiles)
- AI integration (Anthropic Claude via Spring AI)
- AI mocking (Express mock server)
- Database (PostgreSQL with JPA)
- Testing (Playwright E2E)

## Architecture

- **client/** - Angular 21 SPA with Material UI, MSAL authentication
- **server/** - Spring Boot 4 REST API with PostgreSQL, Spring AI
- **mock_anthropic_server/** - Express mock for Claude API
- **test/** - Playwright E2E tests
- **scripts/** - Build and deployment scripts
- **.github/workflows/** - CI/CD pipelines

## Key Technologies

- Spring Boot 4.0.3, Java 21
- Angular 21.2.0
- PostgreSQL 17
- Spring AI 2.0.0-M2 (Anthropic)
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
- `GET /api/greeting` - AI-powered greeting (authenticated)

## Data Model

- **greetings** - Stores name and message used for AI greeting generation

## Configuration Patterns

### Spring Profiles
- **prod** - Production with Azure Key Vault and AAD
- **local** - Local development with Podman DB
- **test** - Testing with disabled auth and mock AI services

### Environment Config
- Server exposes `/api/environment` endpoint
- Client fetches config before bootstrap
- Conditionally enables MSAL based on `mockAuth` flag
