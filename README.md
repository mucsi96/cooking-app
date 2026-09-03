# Cooking App

Recipe collection app with AI-powered import. All recipes are stored and
displayed in Hungarian; the imported text can be in any language.

Based on [skeleton-app](https://github.com/mucsi96/skeleton-app), with the
AI image generation approach of
[learn-language](https://github.com/mucsi96/learn-language).

## Features

- **Category overview** - Recipes grouped by Hungarian categories (Leves,
  Főétel, Desszert, ...) with AI-generated thumbnails
- **Recipe details** - Title, description, ingredients, steps and number of
  servings; adjusting the servings rescales the ingredient amounts
- **AI import** - Paste recipe text in any language (English, German,
  Hungarian, ...); Anthropic Claude extracts a structured recipe and
  translates it to Hungarian before it is persisted
- **API import** - The same endpoint accepts plain text over the API
  (`POST /api/recipes/import` with `{"text": "..."}`), which drives the
  email-based import pipeline
- **Thumbnail candidates** - Several images are generated right away
  (Claude writes the food-photo scene description, the OpenAI image API
  renders it, ffmpeg resizes to webp); the user picks their favorite

## Stack

- **Client** - Angular 22 with Material UI dark theme (Hungarian UI)
- **Server** - Spring Boot 4 with Java 21, Spring AI (Anthropic), openai-java, compiled ahead of time into a GraalVM native image
- **Database** - PostgreSQL with Spring Data JPA and Liquibase
- **Authentication** - Azure AD (MSAL) with conditional mock auth for testing
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **AI Mocking** - Express mock servers for the Anthropic and OpenAI APIs
- **Testing** - Playwright E2E tests
- **Deployment** - Docker multi-stage builds with Traefik reverse proxy

## One image per Spring profile

The server is shipped as a GraalVM native executable. Bean definitions are
resolved during ahead-of-time processing at build time, so the active Spring
profile is baked into the executable and cannot be chosen at startup any more.
The server image is therefore built once per profile, via the `SPRING_PROFILE`
build argument:

```bash
podman build --build-arg SPRING_PROFILE=test -t cooking-app-server:test server   # e2e pod
podman build --build-arg SPRING_PROFILE=prod -t cooking-app-server:prod server   # published image
```

`SPRING_PROFILES_ACTIVE` is not read at runtime; the pipeline builds the test
image for the e2e job and the prod image when publishing to Docker Hub. Running
the server on a JVM for local development is unaffected - `mvn spring-boot:run
-Dspring-boot.run.profiles=local` still selects the profile the usual way.

## Port Mapping

All host-exposed ports use the **xx60–xx69** range for their last two digits
to avoid clashes with other local projects.

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 3060 | Mock Anthropic API   | Test pod                            |
| 3061 | Mock OpenAI API      | Test pod                            |
| 4260 | Angular dev server   | Local dev                           |
| 5460 | PostgreSQL           | Dev database                        |
| 5461 | PostgreSQL           | Test pod                            |
| 8060 | Mock OAuth2 provider | Test pod                            |
| 8063 | Spring Boot server   | Local dev (VSCode)                  |
| 8064 | Spring Boot server   | Test pod (internal, behind Traefik) |
| 8160 | Traefik (web)        | Test pod                            |
| 8161 | Traefik (admin)      | Test pod                            |
| 8162 | Spring Actuator      | Local dev & test                    |

## Development Environment

System tooling (JDK 21, Maven, Node, jq, kubectl, helm, azure-cli) is provided by
a Nix flake dev shell:

```bash
nix develop          # enter the dev shell manually
# or, with direnv installed, `direnv allow` once and it loads automatically
```

Then install the per-project dependencies:

```bash
scripts/install_dependencies.sh
```

**Podman** is a distro-level prerequisite and is not managed by the flake
(rootless Podman needs setuid `newuidmap`/`newgidmap` helpers the Nix store
cannot provide). On WSL, enable `systemd=true` in `/etc/wsl.conf` and install it
via your distro, e.g. `apt install podman`.

**ffmpeg** is required by the server for webp thumbnail conversion (installed
in the server's Alpine runtime image; install it locally for the local profile).

## Quick Start

```bash
# Start test stack
scripts/pod_up.sh

# Run E2E tests
cd test && npm test
```

## Production Secrets

Azure Key Vault must provide, in addition to the skeleton-app secrets:

- `claude-api-key` - Anthropic API key (recipe extraction and image scene descriptions)
- `openai-api-key` - OpenAI API key (thumbnail generation)

The server also needs a `STORAGE_DIRECTORY` environment variable pointing at a
persistent volume for the generated webp images.

See @AGENTS.md
