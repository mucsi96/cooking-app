#!/bin/sh

set -e  # Exit immediately if a command exits with a non-zero status

# System tooling (JDK 21, Maven, Node, jq, kubectl, helm, azure-cli) is provided
# by the Nix flake dev shell — run `nix develop`, or let direnv load it via the
# `.envrc`. Podman is a distro-level prerequisite (e.g. `apt install podman` on
# WSL). This script only installs the per-project dependencies.

echo "Building server..."
cd server && mvn clean install && cd ..

echo "Installing client dependencies..."
cd client && npm install && cd ..

echo "Installing mock Anthropic server dependencies..."
cd mock_anthropic_server && npm install && cd ..

echo "Installing test dependencies..."
cd test && npm install && npx playwright install --with-deps chromium && cd ..
