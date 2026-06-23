# Cloud Run API Deployment

This runbook deploys the MuseScore-backed API to Cloud Run and points a separately hosted browser app at it.

The cost posture is "stay inside the free tier for normal light use," not a hard guarantee of $0. Cloud Run has a monthly free tier for request-based services, but Artifact Registry storage is only free for the first 0.5 GiB per month and this MuseScore image is currently about 879 MB when built locally. Keep `min-instances=0`, cap instances, and prune old images.

Official references:

- Cloud Run pricing: https://cloud.google.com/run/pricing
- Cloud Run cost optimization: https://docs.cloud.google.com/run/docs/tips/services-cost-optimization
- Artifact Registry pricing: https://cloud.google.com/artifact-registry/pricing

## Shape

- API: Cloud Run service from `apps/api/Dockerfile.cloudrun`.
- Web: static build hosted separately, with `VITE_API_BASE_URL` set to the Cloud Run API URL.
- Browser CORS: API allows only origins listed in `CORS_ORIGINS`.
- MuseScore: installed in the API image; `MUSESCORE_USE_XVFB=auto` keeps headless conversion working.

## One-Time Setup

Install and authenticate the Google Cloud CLI, then choose a project with billing enabled.

```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project <project-id>
```

Set deployment variables:

```bash
export PROJECT_ID=<project-id>
export REGION=us-west1
export REPOSITORY=audiotool-score-io
export SERVICE=audiotool-score-api
export WEB_ORIGIN=https://<your-web-origin>
export AUDIOTOOL_CLIENT_ID=<audiotool-client-id>
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api:$(git rev-parse --short HEAD)"
```

Enable the needed APIs:

```bash
gcloud services enable run.googleapis.com artifactregistry.googleapis.com
```

Create the Artifact Registry Docker repository:

```bash
gcloud artifacts repositories create "$REPOSITORY" \
  --repository-format=docker \
  --location="$REGION" \
  --description="Audiotool Score IO containers"
```

Configure Docker auth for the repository:

```bash
gcloud auth configure-docker "$REGION-docker.pkg.dev"
```

## Build And Push

Build locally and push directly to Artifact Registry. This avoids needing Cloud Build for the first deployment.

```bash
docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile.cloudrun \
  -t "$IMAGE" \
  --push \
  .
```

## Deploy API

This deploy keeps idle cost at zero, allows one instance at a time, and serializes MuseScore conversions. Raise `--max-instances` only after you are comfortable with the billing tradeoff.

```bash
gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION" \
  --allow-unauthenticated \
  --cpu=1 \
  --memory=2Gi \
  --concurrency=1 \
  --min-instances=0 \
  --max-instances=1 \
  --timeout=300 \
  --cpu-throttling \
  --set-env-vars "MUSESCORE_USE_XVFB=auto,XVFB_RUN_BIN=xvfb-run,MAX_UPLOAD_BYTES=30000000,JSON_BODY_LIMIT=1mb,CONVERSION_TIMEOUT_MS=120000,DEFAULT_QUANTIZATION_GRID=24,CORS_ORIGINS=$WEB_ORIGIN,AUDIOTOOL_CLIENT_ID=$AUDIOTOOL_CLIENT_ID"
```

Read the API URL:

```bash
export API_URL="$(gcloud run services describe "$SERVICE" \
  --region "$REGION" \
  --format='value(status.url)')"
echo "$API_URL"
```

Check the deployed service:

```bash
curl -sS "$API_URL/health"
curl -sS "$API_URL/ready"
```

`/ready` should report MuseScore as ready. If it does not, inspect logs:

```bash
gcloud run services logs read "$SERVICE" --region "$REGION" --limit=100
```

## Build Web For The API URL

Wherever the web app is hosted, build it with the Cloud Run API URL:

```bash
VITE_API_BASE_URL="$API_URL" \
VITE_AUDIOTOOL_CLIENT_ID="$AUDIOTOOL_CLIENT_ID" \
VITE_AUDIOTOOL_REDIRECT_URL="$WEB_ORIGIN/" \
VITE_AUDIOTOOL_SCOPE=project:write \
npm run build --workspace @midi-to-xml/web
```

Deploy `apps/web/dist` to the static host.

Then update the Audiotool developer app redirect URI to exactly:

```text
$WEB_ORIGIN/
```

## Verification

Open the web app at `$WEB_ORIGIN` and verify:

1. Sign in with Audiotool.
2. Load projects.
3. Inspect a project.
4. Convert one selected note track.
5. Convert multiple selected note tracks.
6. Download the MusicXML or zip.
7. Analyze a MusicXML upload.
8. Import selected parts back to Audiotool.

## Cost Guardrails

- Keep `--min-instances=0`; otherwise Cloud Run can bill while idle.
- Keep request-based CPU allocation with `--cpu-throttling`.
- Keep `--max-instances=1` until you decide a higher cap is worth the spend.
- Keep `--concurrency=1` while MuseScore is the conversion engine.
- Keep `MAX_UPLOAD_BYTES` below Cloud Run's request size limit and low enough to discourage expensive uploads.
- Delete old Artifact Registry image versions after each few deployments.
- Create a Google Cloud budget alert. Budget alerts are warnings, not hard spending caps.

Useful image cleanup commands:

```bash
gcloud artifacts docker images list "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api" \
  --include-tags
```

Delete old digests from the list above when they are no longer deployed:

```bash
gcloud artifacts docker images delete <image-digest-url> --quiet
```

## Updating The API Later

```bash
export IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api:$(git rev-parse --short HEAD)"

docker buildx build \
  --platform linux/amd64 \
  -f apps/api/Dockerfile.cloudrun \
  -t "$IMAGE" \
  --push \
  .

gcloud run deploy "$SERVICE" \
  --image "$IMAGE" \
  --region "$REGION"
```
