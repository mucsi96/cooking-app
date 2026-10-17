#!/bin/bash

set -e  # Exit immediately if a command exits with a non-zero status

: "${AZURE_KEYVAULT_NAME:?Environment variable AZURE_KEYVAULT_NAME is required}"
: "${SERVER_IMAGE:?Set the versioned server image to deploy}"
: "${CLIENT_IMAGE:?Set the versioned client image to deploy}"
if [[ ! "$SERVER_IMAGE" =~ ^ghcr\.io/.+(:[1-9][0-9]*|@sha256:[a-f0-9]{64})$ ]] ||
   [[ ! "$CLIENT_IMAGE" =~ ^ghcr\.io/.+(:[1-9][0-9]*|@sha256:[a-f0-9]{64})$ ]]; then
    printf '%s\n' 'SERVER_IMAGE and CLIENT_IMAGE must use GHCR with a release version or sha256 digest.' >&2
    exit 1
fi

AZURE_KEYVAULT_ENDPOINT="https://${AZURE_KEYVAULT_NAME}.vault.azure.net/"
SERVER_RELEASE_NAME=cooking-server
CLIENT_RELEASE_NAME=cooking-client

# Create a temporary file in /dev/shm (RAM) to avoid writing to disk
KUBECONFIG=$(mktemp /dev/shm/kubeconfig.XXXXXX)
export KUBECONFIG

# Ensure the temporary file is deleted when the script exits
trap 'rm -f "$KUBECONFIG"' EXIT

"$(dirname "$0")/pull_kubeconfig.sh"

HOSTNAME=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name hostname --query value -o tsv)
API_CLIENT_ID=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name api-client-id --query value -o tsv)
AUTH_CONFIG=$(az keyvault secret show --vault-name "$AZURE_KEYVAULT_NAME" --name forward-auth-config --query value -o tsv)
AUTH_RELEASE=$(jq -er '.release_name | select(type == "string" and length > 0)' <<<"$AUTH_CONFIG")
AUTH_SESSION_URL=$(jq -er '.session_url | select(type == "string" and test("^https?://"))' <<<"$AUTH_CONFIG")
AUTH_SIGN_IN_URL=$(jq -er '.sign_in_url | select(type == "string" and test("^https?://"))' <<<"$AUTH_CONFIG")
API_ROUTE_FILTERS=$(jq -ce --arg middleware "${AUTH_RELEASE}-api" '.route_filters.api | select(type == "array" and any(.[]; .type == "ExtensionRef" and .extensionRef.group == "traefik.io" and .extensionRef.kind == "Middleware" and .extensionRef.name == $middleware))' <<<"$AUTH_CONFIG")

echo "Updating Helm repositories..."
# The shared charts do not bundle Prometheus exporter sidecars or ServiceMonitors.
helm repo add mucsi96 https://mucsi96.github.io/k8s-helm-charts --force-update

goAppChartVersion=$(helm search repo mucsi96/go-app --output json | jq -er '.[0].version')
clientAppChartVersion=$(helm search repo mucsi96/client-app --output json | jq -r '.[0].version')

helm status "$AUTH_RELEASE" --namespace cooking >/dev/null
helm show values mucsi96/go-app --version "$goAppChartVersion" | grep -q '^routeFilters:'

echo "Deploying server: $SERVER_IMAGE using go-app chart $goAppChartVersion"

# CPU limits are intentionally omitted for both services (limits.cpu=null
# clears the chart default): on a single-user node they only throttle
# startup and the ffmpeg runs; memory limits are the ones that matter.
#
# The Go executable uses GOMEMLIMIT=256MiB (see server/Dockerfile). The 768Mi
# container limit also leaves room for ffmpeg image conversion subprocesses.
helm upgrade $SERVER_RELEASE_NAME mucsi96/go-app \
    --install \
    --version $goAppChartVersion \
    --set-string image="$SERVER_IMAGE" \
    --set host=$HOSTNAME \
    --set basePath=/api \
    --set-json routeFilters="$API_ROUTE_FILTERS" \
    --set clientId=$API_CLIENT_ID \
    --set serviceAccountName=cooking-api-workload-identity \
    --set env.AZURE_KEYVAULT_ENDPOINT=$AZURE_KEYVAULT_ENDPOINT \
    --set env.CLIENT_APP_NAME=$CLIENT_RELEASE_NAME \
    --set-string env.BROWSER_ORIGIN="https://$HOSTNAME" \
    --set-string env.AUTH_SESSION_URL="$AUTH_SESSION_URL" \
    --set-string env.AUTH_SIGN_IN_URL="$AUTH_SIGN_IN_URL" \
    --set env.STORAGE_DIRECTORY=/app/storage \
    --set persistentVolumeClaims[0].name=cooking-pvc \
    --set persistentVolumeClaims[0].accessMode=ReadWriteOnce \
    --set persistentVolumeClaims[0].volumeName=cooking-app \
    --set persistentVolumeClaims[0].mountPath=/app/storage \
    --set persistentVolumeClaims[0].storageClassName="" \
    --set persistentVolumeClaims[0].storage=5Gi \
    --set resources.requests.memory=128Mi \
    --set resources.requests.cpu=25m \
    --set resources.limits.memory=768Mi \
    --set resources.limits.cpu=null \
    --wait

echo "Deploying client: $CLIENT_IMAGE using client-app chart $clientAppChartVersion"

helm upgrade $CLIENT_RELEASE_NAME mucsi96/client-app \
    --install \
    --reset-values \
    --version $clientAppChartVersion \
    --set-string image="$CLIENT_IMAGE" \
    --set host=$HOSTNAME \
    --set resources.requests.memory=8Mi \
    --set resources.requests.cpu=5m \
    --set resources.limits.memory=32Mi \
    --set resources.limits.cpu=null \
    --wait
