#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "Stopping development database pod..."
podman kube down "$PROJECT_DIR/server/dev-db-pod.yaml" 2>/dev/null || true

echo "Development database stopped."
