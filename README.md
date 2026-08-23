# Cooking App

Reference application for all future projects. Based on patterns from [learn-language](https://github.com/mucsi96/learn-language).

## Patterns Covered

- **CI/CD Pipeline** - GitHub Actions with E2E testing and image publishing
- **Deployment** - Docker multi-stage builds with Traefik reverse proxy
- **Client** - Angular 21 with Material UI dark theme
- **Server** - Spring Boot 4 with Java 21
- **Authentication** - Azure AD (MSAL) with conditional mock auth for testing
- **Configuration** - Azure Key Vault + Spring profiles (prod/local/test)
- **AI Integration** - Anthropic Claude via Spring AI
- **AI Mocking** - Express mock server for testing
- **Database** - PostgreSQL with Spring Data JPA
- **Testing** - Playwright E2E tests
- **UI Components** - Material UI with custom dark theme
- **Fetching** - Angular resource API with HttpClient

## AI Pattern Sync

This repository publishes a diff of the last 2 weeks of changes to GitHub Pages. AI agents on other projects can fetch this diff to stay in sync with the latest patterns from cooking-app.

- **Commits**: `https://mucsi96.github.io/cooking-app/commits.txt`
- **Diff**: `https://mucsi96.github.io/cooking-app/diff.patch` (or `https://mucsi96.github.io/cooking-app/diff.txt` to view inline in browser)

The pages build runs on every push to main, weekly on Monday, and on manual dispatch.

## Port Mapping

All host-exposed ports use the **xx50–xx59** range for their last two digits to avoid clashes with other local projects.

| Port | Service              | Context                             |
|------|----------------------|-------------------------------------|
| 3060 | Mock Anthropic API   | Test pod                            |
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

## Quick Start

```bash
# Start test stack
scripts/compose_up.sh

# Run E2E tests
cd test && npm test
```
