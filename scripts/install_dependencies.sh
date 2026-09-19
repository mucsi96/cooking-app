#!/bin/sh
set -eu

PROJECT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

# Go, Node and ffmpeg are supplied by nix develop; Podman is installed by the OS.
(cd "$PROJECT_DIR/server" && go mod download && go build ./...)
for project in client mock_anthropic_server mock_openai_server test; do
  (cd "$PROJECT_DIR/$project" && npm ci)
done
(cd "$PROJECT_DIR/test" && npx playwright install --with-deps chromium)
