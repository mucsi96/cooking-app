#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
POD_NAME="cooking-app-test"
MAX_WAIT=120

if [ "${SKIP_BUILD:-}" = "1" ]; then
  echo "Skipping image build (SKIP_BUILD=1)..."
else
  echo "Building container images..."
  podman build -t localhost/cooking-app-server:test "$PROJECT_DIR/server" &
  podman build -t localhost/cooking-app-client:test "$PROJECT_DIR/client" &
  podman build -t localhost/cooking-app-mock-anthropic:test "$PROJECT_DIR/mock_anthropic_server" &
  wait
fi

echo "Cleaning up existing pod..."
podman kube down "$PROJECT_DIR/test/test-pod.yaml" 2>/dev/null || true

echo "Starting pod..."
podman kube play "$PROJECT_DIR/test/test-pod.yaml"

dump_logs() {
  for c in $CONTAINERS; do
    echo "$c" | grep -q "infra" && continue
    echo "=== $c ==="
    podman logs "$c" 2>&1 | tail -20
  done
}

echo "Waiting for all containers to become healthy..."
CONTAINERS=$(podman pod inspect "$POD_NAME" --format '{{range .Containers}}{{.Name}} {{end}}')

for container in $CONTAINERS; do
  if echo "$container" | grep -q "infra"; then
    continue
  fi
  echo "  Waiting for $container..."
  ELAPSED=0
  # Run each container's healthcheck on demand instead of reading
  # .State.Health.Status: Podman 5 on GitHub runners never schedules or
  # records probe runs, so the status alone never becomes "healthy".
  until podman healthcheck run "$container" > /dev/null 2>&1; do
    if [ "$ELAPSED" -ge "$MAX_WAIT" ]; then
      echo "Timeout waiting for $container to become healthy"
      dump_logs
      exit 1
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done
  echo "  $container is healthy"
done

echo "All services are ready!"
