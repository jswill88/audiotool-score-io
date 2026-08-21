#!/usr/bin/env bash
set -euo pipefail

: "${PROJECT_ID:?Set PROJECT_ID to the Google Cloud project ID.}"

REGION="${REGION:-us-west1}"
REPOSITORY="${REPOSITORY:-audiotool-score-io}"
SERVICE="${SERVICE:-audiotool-score-api}"
MAX_UPLOAD_BYTES="${MAX_UPLOAD_BYTES:-30000000}"
JSON_BODY_LIMIT="${JSON_BODY_LIMIT:-1mb}"
BOOTSTRAP_INFRA="${BOOTSTRAP_INFRA:-true}"
PRESERVE_SERVICE_ENV="${PRESERVE_SERVICE_ENV:-false}"
MANAGE_SERVICE_ACCESS="${MANAGE_SERVICE_ACCESS:-true}"

case "$BOOTSTRAP_INFRA" in
  true|false) ;;
  *) printf 'BOOTSTRAP_INFRA must be true or false.\n' >&2; exit 1 ;;
esac

case "$PRESERVE_SERVICE_ENV" in
  true|false) ;;
  *) printf 'PRESERVE_SERVICE_ENV must be true or false.\n' >&2; exit 1 ;;
esac

case "$MANAGE_SERVICE_ACCESS" in
  true|false) ;;
  *) printf 'MANAGE_SERVICE_ACCESS must be true or false.\n' >&2; exit 1 ;;
esac

if [[ "$PRESERVE_SERVICE_ENV" == "false" ]]; then
  : "${WEB_ORIGIN:?Set WEB_ORIGIN to the production Cloudflare Pages origin without a trailing slash.}"
  : "${AUDIOTOOL_CLIENT_ID:?Set AUDIOTOOL_CLIENT_ID to the Audiotool application client ID.}"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
POLICY_FILE="$REPO_ROOT/docs/deployment/artifact-registry-cleanup-policy.json"
IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api:$(git -C "$REPO_ROOT" rev-parse --short HEAD)"

gcloud config set project "$PROJECT_ID"
if [[ "$BOOTSTRAP_INFRA" == "true" ]]; then
  gcloud services enable run.googleapis.com artifactregistry.googleapis.com

  if ! gcloud artifacts repositories describe "$REPOSITORY" \
    --project="$PROJECT_ID" \
    --location="$REGION" >/dev/null 2>&1; then
    gcloud artifacts repositories create "$REPOSITORY" \
      --project="$PROJECT_ID" \
      --repository-format=docker \
      --location="$REGION" \
      --description="Audiotool Score IO containers"
  fi

  gcloud artifacts repositories set-cleanup-policies "$REPOSITORY" \
    --project="$PROJECT_ID" \
    --location="$REGION" \
    --policy="$POLICY_FILE" \
    --no-dry-run
fi

gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

docker buildx build \
  --platform linux/amd64 \
  --file "$REPO_ROOT/apps/api/Dockerfile.cloudrun" \
  --tag "$IMAGE" \
  --push \
  "$REPO_ROOT"

declare -a ENV_ARGS=()
if [[ "$PRESERVE_SERVICE_ENV" == "false" ]]; then
  ENV_ARGS+=(
    "--set-env-vars=MAX_UPLOAD_BYTES=$MAX_UPLOAD_BYTES,JSON_BODY_LIMIT=$JSON_BODY_LIMIT,CORS_ORIGINS=$WEB_ORIGIN,AUDIOTOOL_CLIENT_ID=$AUDIOTOOL_CLIENT_ID"
  )
fi

declare -a ACCESS_ARGS=()
if [[ "$MANAGE_SERVICE_ACCESS" == "true" ]]; then
  ACCESS_ARGS+=(--allow-unauthenticated)
fi

gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --image="$IMAGE" \
  --region="$REGION" \
  --cpu=1 \
  --memory=1Gi \
  --concurrency=4 \
  --min-instances=0 \
  --max-instances=2 \
  --timeout=300 \
  --cpu-throttling \
  "${ACCESS_ARGS[@]}" \
  "${ENV_ARGS[@]}"

API_URL="$(gcloud run services describe "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --format='value(status.url)')"

curl --fail --silent --show-error "$API_URL/health"
printf '\n'
curl --fail --silent --show-error "$API_URL/ready"
printf '\n\nCloud Run deployment complete.\n'
printf 'API URL: %s\n\n' "$API_URL"

if [[ "$PRESERVE_SERVICE_ENV" == "false" ]]; then
  printf 'Set these Cloudflare Pages production environment variables, then redeploy:\n'
  printf 'VITE_API_BASE_URL=%s\n' "$API_URL"
  printf 'VITE_AUDIOTOOL_CLIENT_ID=%s\n' "$AUDIOTOOL_CLIENT_ID"
  printf 'VITE_AUDIOTOOL_REDIRECT_URL=%s/\n' "$WEB_ORIGIN"
  printf 'VITE_AUDIOTOOL_SCOPE=project:write\n'
fi
