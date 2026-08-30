#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POD_NAME="cooking-app-dev-db"
DB_CONTAINER="cooking-app-dev-db-db"
MAX_WAIT=60

if podman inspect --format='{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -q "true"; then
  echo "Database is already running"
  exit 0
fi

echo "Cleaning up existing pod..."
podman kube down "$PROJECT_DIR/server/dev-db-pod.yaml" 2>/dev/null || true

echo "Starting dev database pod..."
podman kube play "$PROJECT_DIR/server/dev-db-pod.yaml"

echo "Waiting for database to become healthy..."
ELAPSED=0
while true; do
  if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
    echo "Timeout waiting for database to become healthy"
    exit 1
  fi
  STATUS=$(podman inspect --format='{{.State.Health.Status}}' "$DB_CONTAINER" 2>/dev/null || echo "missing")
  if [ "$STATUS" = "healthy" ]; then
    echo "Development database is ready on port 5460"
    break
  fi
  sleep 2
  ELAPSED=$((ELAPSED + 2))
done
