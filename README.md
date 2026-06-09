# MIDI to XML Tools

A monorepo for MIDI, MusicXML, and Audiotool conversion tools.

## Workspace layout

- `packages/midi-to-musicxml`: standalone TypeScript MIDI to MusicXML conversion package with optional quantization and MuseScore support.
- `packages/audiotool-to-midi`: standalone Audiotool note-track to MIDI package. Audiotool extraction is intentionally separate from MIDI to MusicXML conversion.
- `apps/api`: Express TypeScript API that wraps the packages for upload/conversion workflows.
- `apps/web`: React/Vite TypeScript browser app for Audiotool sign-in, project/track selection, conversion, and MusicXML viewing.

For a file-by-file navigation guide, see [`CODEMAP.md`](CODEMAP.md).

## Run locally

Requires Node.js 22 or newer. The Audiotool SDK uses modern Promise APIs that are not available in Node 20.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optionally create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Register an Audiotool application at `https://developer.audiotool.com/applications`.

   For Vite dev, add this redirect URI to the Audiotool application:

   ```text
   http://127.0.0.1:5173/
   ```

   Then set `VITE_AUDIOTOOL_CLIENT_ID` in `.env`. The client ID is safe to expose in the browser.
   Audiotool browser sign-in uses Web Crypto for OAuth. Open the app through `http://127.0.0.1:5173/`,
   `http://localhost:5173/`, or HTTPS; browser sign-in can fail on insecure LAN or `0.0.0.0` origins.

4. Start the server. This builds the TypeScript packages before launching the API:

   ```bash
   npm run start:api
   ```

5. Start the web app:

   ```bash
   npm run dev
   ```

   Open `http://127.0.0.1:5173/`. The Vite dev server proxies API requests to `http://127.0.0.1:3000`.
   CSS changes hot reload through Vite. If the Docker web container is already using port `5173`,
   stop it with `docker compose stop web` or run Vite on another port:

   ```bash
   npm run dev -- --port 5174
   ```

6. Send a `POST` request to `/convert` with a `multipart/form-data` field named `file`.

   Example using `curl`:

   ```bash
   curl -F "file=@song.mid" http://localhost:3000/convert --output song.musicxml
   ```

Check runtime readiness, including MuseScore and virtual display availability:

```bash
curl http://localhost:3000/ready
```

### Quantization options

Set `?quantize=false` to bypass MIDI timing quantization altogether. `?preprocess=false` is also supported as a backward-compatible alias.

Set `?grid=8`, `?grid=16`, or another supported grid value to control quantization. Supported values are `4`, `8`, `12`, `16`, `24`, `32`, `48`, and `64`.

## Audiotool to MIDI

`@midi-to-xml/audiotool-to-midi` exports Audiotool note tracks as standard MIDI. It keeps the Audiotool track entity ID as the stable key, while using track order and player display name for labels.

Core helpers:

```js
import {
  createAudiotoolSession,
  getAudiotoolProjectDetails,
  inspectAudiotoolProject,
  openAudiotoolProject,
  exportAudiotoolProjectToMidi
} from '@midi-to-xml/audiotool-to-midi';

const client = await createAudiotoolSession({ pat: process.env.AUDIOTOOL_PAT });
const details = await getAudiotoolProjectDetails(client, projectUrl);
const project = await openAudiotoolProject(client, details.reference.projectUrl);
const manifest = inspectAudiotoolProject(project);

const result = await exportAudiotoolProjectToMidi(project, {
  tracks: [manifest.tracks[0].id],
  mode: 'both'
});
```

Supported MIDI output modes are:

- `combined`: one MIDI file with one track per selected Audiotool note track.
- `separate`: one MIDI file per selected Audiotool note track.
- `both`: a combined MIDI file plus the separate part files.

The exporter handles note regions, collection offsets, looping regions, disabled tracks/regions, and slide-note warnings. Audio/sample tracks are intentionally out of scope for this package because they require transcription rather than direct MIDI extraction.

Project references can be a full Audiotool Studio URL, a UUID, or a `projects/{project_id}` resource name. Full URLs are useful for the site flow because the app can fetch project details first, show the user what they selected, and then open the project for track inspection/export.

### Audiotool API flow

The web app uses Audiotool browser OAuth through `@audiotool/nexus`, exports the user's access/refresh token data, and sends those tokens to the API for server-side conversion. For scripts or server-only demos, set `AUDIOTOOL_PAT` in `.env`, or send a bearer token in the request.

Fetch project details without opening the full DAW document:

List accessible projects:

```bash
curl -X POST http://localhost:3000/audiotool/projects \
  -H "Content-Type: application/json" \
  -d '{"pageSize":25}'
```

```bash
curl -X POST http://localhost:3000/audiotool/project \
  -H "Content-Type: application/json" \
  -d '{"project":"https://beta.audiotool.com/studio?project=<project-id>"}'
```

Inspect exportable note tracks:

```bash
curl -X POST http://localhost:3000/audiotool/inspect \
  -H "Content-Type: application/json" \
  -d '{"project":"https://beta.audiotool.com/studio?project=<project-id>"}'
```

Convert selected Audiotool tracks all the way to MusicXML:

```bash
curl -X POST "http://localhost:3000/audiotool/convert?quantize=false" \
  -H "Content-Type: application/json" \
  -d '{"project":"https://beta.audiotool.com/studio?project=<project-id>","tracks":["<track-id>"],"mode":"score"}' \
  --output audiotool.musicxml
```

Use `"mode":"parts"` for one MusicXML file per selected track, or `"mode":"both"` for a zip containing the full score and parts.

## MuseScore configuration

The service searches for `mscore`, `mscore4`, `musescore`, `musescore3`, or `musescore4` in `PATH`. Set `MUSESCORE_BIN=/path/to/musescore` to use a specific executable.

MuseScore may need a display even when used from the CLI. On Linux with no `DISPLAY`, the service automatically wraps conversion in `xvfb-run -a`. The Docker image installs `xvfb` and `xauth` for this path.

Useful environment variables:

- `MUSESCORE_USE_XVFB=auto|always|never` controls virtual-display usage. Default: `auto`.
- `XVFB_RUN_BIN=/path/to/xvfb-run` points at a custom wrapper.
- `MAX_UPLOAD_BYTES=52428800` controls the upload limit. Default: 50 MB.
- `JSON_BODY_LIMIT=1mb` controls JSON request size. Default: 1 MB.
- `CONVERSION_TIMEOUT_MS=120000` controls the MuseScore timeout. Default: 120 seconds.
- `DEFAULT_QUANTIZATION_GRID=24` controls quantization when `?grid=` is not supplied.
- `VITE_AUDIOTOOL_CLIENT_ID` enables browser OAuth login for the web app.
- `VITE_AUDIOTOOL_REDIRECT_URL` overrides the OAuth redirect URL. Leave blank to use the browser's current origin.
- `VITE_AUDIOTOOL_SCOPE=project:write` controls requested Audiotool OAuth scopes. The browser app opens/syncs projects through Nexus, which currently requires `project:write`.
- `AUDIOTOOL_CLIENT_ID` optionally provides an API-side client ID fallback for browser-exported OAuth tokens.
- `AUDIOTOOL_PAT` optionally provides server-side Audiotool auth for the Audiotool API routes.

## Docker

Start a local Docker dev environment with Vite hot reload:

```bash
npm run docker:dev
```

Open `http://127.0.0.1:5173/`. The web service runs Vite in a Node container,
mounts the local source tree, and proxies API requests to the Compose `api`
service. CSS changes should hot reload on save.

Stop the Docker dev environment:

```bash
npm run docker:dev:down
```

If dependencies change, rebuild the dev image and recreate the dependency volume:

```bash
docker compose -f compose.dev.yml down -v
npm run docker:dev
```

Start the production-style API and static web app together:

```bash
docker compose up --build
```

Register `http://127.0.0.1:5173/` as an Audiotool redirect URI, set `VITE_AUDIOTOOL_CLIENT_ID` in `.env`, then open `http://127.0.0.1:5173/`. The web container serves the React app and proxies `/audiotool`, `/convert`, `/health`, and `/ready` to the API container.

Optional host port overrides:

```bash
API_PORT=3100 WEB_PORT=8180 docker compose up --build
```

Compose reads values from `.env` for settings such as `AUDIOTOOL_PAT`, `DEFAULT_QUANTIZATION_GRID`, and upload limits. The API container includes MuseScore, `xvfb`, and `xauth`, so headless MusicXML conversion can run with `MUSESCORE_USE_XVFB=auto`.

Stop both containers:

```bash
docker compose down
```

### API-only image

Build the image:

```bash
docker build -t midi-to-musicxml .
```

Run the container:

```bash
docker run --rm -p 3000:3000 midi-to-musicxml
```

Or pass a local environment file:

```bash
docker run --rm --env-file .env -p 3000:3000 midi-to-musicxml
```

Then upload MIDI to `http://localhost:3000/convert`.
