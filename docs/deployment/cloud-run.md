# Cloud Run API + Cloudflare Pages Deployment

This is the primary production plan:

- Cloud Run hosts the Node API and scales to zero.
- Cloudflare Pages hosts the static React/Vite app.
- Artifact Registry stores API images and automatically deletes old versions.
- Cloudflare automatically rebuilds the web app when `main` changes.
- GitHub Actions tests and deploys the Cloud Run API when `main` changes.

The API has no database or persistent filesystem requirement. Uploaded files are temporary.

## Who Does What

### You must do

These steps require account ownership, billing consent, or browser authorization:

1. Choose or create the Google Cloud project and enable billing.
2. Create a Google Cloud budget alert.
3. Connect the GitHub repository to Cloudflare Pages.
4. Approve Google Cloud and Docker authentication prompts.
5. Register the final Cloudflare URL in the Audiotool developer application.
6. Perform the final real Audiotool OAuth test.

### Codex can do

Once you have authenticated locally and supplied the values below, you can ask Codex to:

1. Check/install the required CLIs.
2. Run the API deployment script.
3. Create the Artifact Registry repository.
4. Apply the automatic image cleanup policy.
5. Build, push, and deploy the API.
6. Verify health, readiness, CORS, MIDI conversion, and MusicXML import.
7. Help enter or verify the Cloudflare build settings.
8. Maintain the push-to-main API deployment automation and its Google Cloud identity.

Do not send passwords, billing details, refresh tokens, or private keys in chat. Browser login and CLI authentication should happen directly on your machine.

## Values To Decide

Defaults are already encoded in the deployment script except for the three required values:

```bash
export PROJECT_ID=<google-cloud-project-id>
export WEB_ORIGIN=https://<cloudflare-pages-project>.pages.dev
export AUDIOTOOL_CLIENT_ID=<audiotool-client-id>

# Optional overrides:
export REGION=us-west1
export REPOSITORY=audiotool-score-io
export SERVICE=audiotool-score-api
```

`WEB_ORIGIN` must not end with `/`. The Audiotool redirect URI will use the same value with a trailing `/`.

## Step 1: Prepare Accounts

### Google Cloud — you

1. Create or select a Google Cloud project.
2. Enable billing.
3. Create a small budget alert.
4. Install the Google Cloud CLI if it is not installed.
5. Authenticate:

```bash
gcloud auth login
```

The deploy script enables the required Cloud Run and Artifact Registry APIs.

### Cloudflare — you

1. Create or sign in to a Cloudflare account.
2. Open **Workers & Pages**.
3. Create a Pages application connected to this GitHub repository.
4. Choose a stable project name. This produces a URL such as:

```text
https://audiotool-score-io.pages.dev
```

You need this URL before deploying Cloud Run because the API CORS policy permits the production web origin explicitly.

## Step 2: Bootstrap Cloudflare Pages

Use these Pages build settings:

| Setting | Value |
|---|---|
| Production branch | `main` |
| Root directory | repository root / blank |
| Build command | `npm run build --workspace @midi-to-xml/web` |
| Build output directory | `apps/web/dist` |

Add these production environment variables:

```text
NODE_VERSION=22
VITE_AUDIOTOOL_CLIENT_ID=<audiotool-client-id>
VITE_AUDIOTOOL_SCOPE=project:write
```

Leave `VITE_API_BASE_URL` and `VITE_AUDIOTOOL_REDIRECT_URL` unset for this first bootstrap build. The first build exists to reserve the Pages URL.

Cloudflare Pages automatically treats the build as a single-page application because the output has no top-level `404.html`. Direct visits to `/sign-in` and `/app` therefore resolve to the React app without a custom redirect file.

After the first deployment, record the exact production origin without a trailing slash:

```bash
export WEB_ORIGIN=https://audiotool-score-io.pages.dev
```

## Step 3: Deploy The Cloud Run API

From the repository root, set the required values:

```bash
export PROJECT_ID=<google-cloud-project-id>
export WEB_ORIGIN=https://<cloudflare-pages-project>.pages.dev
export AUDIOTOOL_CLIENT_ID=<audiotool-client-id>
```

Then run:

```bash
npm run deploy:cloud-run
```

This script:

1. Selects the Google Cloud project.
2. Enables Cloud Run and Artifact Registry.
3. Creates the Docker repository if it does not exist.
4. Activates [`artifact-registry-cleanup-policy.json`](artifact-registry-cleanup-policy.json).
5. Builds and pushes the API image.
6. Deploys Cloud Run with:
   - 1 CPU
   - 1 GiB RAM
   - concurrency 4
   - minimum instances 0
   - maximum instances 2
   - five-minute request timeout
7. Checks `/health` and `/ready`.
8. Prints the final Cloudflare environment variables.

The cleanup policy deletes API images older than 14 days but always keeps the five newest versions. Artifact Registry runs it automatically in the background.

You can delegate this entire step to Codex after `gcloud auth login` has been completed and the three required environment values are known. The underlying script is [`scripts/deploy/cloud-run.sh`](../../scripts/deploy/cloud-run.sh).

## Step 4: Finish Cloudflare Configuration

The deployment script prints values resembling:

```text
VITE_API_BASE_URL=https://audiotool-score-api-....run.app
VITE_AUDIOTOOL_CLIENT_ID=...
VITE_AUDIOTOOL_REDIRECT_URL=https://audiotool-score-io.pages.dev/
VITE_AUDIOTOOL_SCOPE=project:write
```

In Cloudflare Pages:

1. Open the project.
2. Go to **Settings → Environment variables**.
3. Add those values to the production environment.
4. Trigger a new production deployment.

Cloudflare will automatically deploy future frontend changes pushed to `main`.

## Step 5: Update Audiotool

In the Audiotool developer application, add this exact redirect URI:

```text
https://<cloudflare-pages-project>.pages.dev/
```

The trailing slash matters.

If you later add a custom domain:

1. Change `WEB_ORIGIN` to the custom origin.
2. Run `npm run deploy:cloud-run` again to update API CORS.
3. Update `VITE_AUDIOTOOL_REDIRECT_URL` in Cloudflare.
4. Add the custom-domain redirect URI in Audiotool.

## Step 6: Production Verification

### Codex can verify

```bash
curl -sS "$API_URL/health"
curl -sS "$API_URL/ready"
```

Expected:

```text
ok
{"status":"ready","converter":"direct"}
```

Codex can also verify the production CORS preflight and run synthetic MIDI/MusicXML smoke tests.

### You verify

Open the Cloudflare URL and test:

1. Sign in with Audiotool.
2. Load projects.
3. Inspect a project.
4. Convert one selected note track.
5. Convert multiple tracks.
6. Download MusicXML or a zip.
7. Choose a MusicXML and an MXL upload and confirm that each is analyzed automatically.
8. Import selected parts into Audiotool.

The real OAuth consent and project access test must be done in your browser/account.

## Ongoing Deployments

### Frontend

Cloudflare Pages deploys automatically on pushes to `main`.

### API

The [`Deploy API`](../../.github/workflows/deploy-api.yml) GitHub Actions workflow runs `npm test`, `npm run check`, and the Cloud Run deployment on every push to `main`. It can also be started manually with **Actions → Deploy API → Run workflow**.

The workflow uses Google Workload Identity Federation rather than a stored service-account key. Its provider accepts only OIDC tokens for this repository's immutable GitHub repository ID on `main`. The deploy identity can write images to this Artifact Registry repository, update Cloud Run revisions, and act as the service's runtime identity; it cannot bootstrap APIs or repositories, apply cleanup policies, or change the service's public-access policy.

Automated deployments preserve the Cloud Run service's existing environment variables and public-access policy. To change CORS, the Audiotool client ID, or other service configuration, run the full local deployment:

```bash
export PROJECT_ID=<google-cloud-project-id>
export WEB_ORIGIN=https://<production-web-origin>
export AUDIOTOOL_CLIENT_ID=<audiotool-client-id>
npm run deploy:cloud-run
```

Both paths tag each image with the current Git commit and update Cloud Run. The workflow cancels an older in-progress deployment when a newer commit reaches `main`.

### One-time GitHub Actions identity setup

The current production identity uses:

```text
Workload Identity Pool: github-actions
Provider: audiotool-score-io
Deploy service account: github-actions-cloud-run@score-io-500615.iam.gserviceaccount.com
GitHub repository ID: 1264427069
```

If the workflow is moved to a different repository or Google Cloud project, recreate the provider and IAM bindings for that repository. Do not replace Workload Identity Federation with a downloaded service-account key.

## Rollback

List recent images:

```bash
gcloud artifacts docker images list \
  "$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api" \
  --include-tags
```

Deploy a previous image tag:

```bash
gcloud run deploy "$SERVICE" \
  --project="$PROJECT_ID" \
  --region="$REGION" \
  --image="$REGION-docker.pkg.dev/$PROJECT_ID/$REPOSITORY/api:<old-commit-tag>"
```

The cleanup policy keeps the five newest versions available for rollback.

## Cost Controls

- Cloud Run minimum instances stays at zero.
- Cloud Run uses request-based CPU allocation.
- Maximum instances is capped at two.
- Artifact Registry cleanup is automatic.
- Cloudflare serves static assets without running an application server.
- Create a Google Cloud budget alert even if expected usage is within the free tier.

Official references:

- [Cloud Run pricing](https://cloud.google.com/run/pricing)
- [Cloud Run request timeouts](https://docs.cloud.google.com/run/docs/configuring/request-timeout)
- [Artifact Registry cleanup policies](https://docs.cloud.google.com/artifact-registry/docs/repositories/cleanup-policy)
- [Cloudflare Pages build configuration](https://developers.cloudflare.com/pages/configuration/build-configuration/)
- [Cloudflare Pages SPA behavior](https://developers.cloudflare.com/pages/configuration/serving-pages/)
