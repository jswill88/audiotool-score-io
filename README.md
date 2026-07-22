# MIDI to XML Tools

A monorepo for MIDI, MusicXML, and Audiotool conversion tools.

## Workspace layout

- `packages/midi-to-musicxml`: standalone TypeScript MIDI-to-MusicXML package with automatic multi-grid quantization and direct notation generation.
- `packages/audiotool-to-midi`: standalone TypeScript Audiotool note-track to MIDI exporter.
- `packages/score-to-audiotool`: standalone TypeScript MusicXML score importer that turns score parts into editable Audiotool note tracks.
- `apps/api`: Express TypeScript API that wraps the packages for upload/conversion workflows.
- `apps/web`: React/Vite TypeScript browser app for Audiotool sign-in, project/track selection, MusicXML export, MusicXML import, and score viewing.
- `experiments/notation-ranker`: offline synthetic-data starter for evaluating ML-guided quantization and notation candidate ranking.

For a file-by-file navigation guide, see [`docs/CODEMAP.md`](docs/CODEMAP.md).

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

   Open `http://127.0.0.1:5173/`. The root route redirects to `/sign-in` or `/app` based on the
   Audiotool auth state; `/app` is the protected converter workspace. The Vite dev server proxies API
   requests to `http://127.0.0.1:3000`.
   CSS changes hot reload through Vite. If the Docker web container is already using port `5173`,
   stop it with `docker compose stop web` or run Vite on another port:

   ```bash
   npm run dev -- --port 5174
   ```

6. Send a `POST` request to `/convert` with a `multipart/form-data` field named `file`.

   Example using `curl`:

   ```bash
   curl -F "file=@song.mid" "http://localhost:3000/convert" --output song.musicxml
   ```

Check runtime readiness:

```bash
curl http://localhost:3000/ready
```

### Quantization options

Set `?quantize=false` to bypass MIDI timing quantization altogether.

When quantization is enabled, the shared multi-grid quantizer produces canonical MIDI before direct MusicXML generation. It evaluates several ordinary and triplet grids automatically.

Consistently extreme high or low parts use whole-part octave clefs automatically: treble 8va/15ma for high parts and bass 8vb/15mb for low parts. Set `octaveClefs: 'off'` in the package API to keep ordinary treble/bass clefs plus measure-local octave-shift directions only.

The package also exports `quantizeMidiForNotation` and `quantizeMidiBytesForNotation` for callers that want the canonical MIDI directly.

The package API exposes the same choice:

```js
await convertMidiToMusicXml({
  inputPath: 'song.mid',
  octaveClefs: 'auto',
  outputPath: 'song.musicxml'
});
```

## Audiotool to MIDI

`@midi-to-xml/audiotool-to-midi` exports Audiotool note tracks as standard MIDI. It keeps the Audiotool track entity ID as the stable key, while using track order and player display name for labels. The web app lets users edit the score title and each track's export title before conversion; blank edits fall back to the detected project or track label.

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
  mode: 'both',
  title: 'Project Sonata',
  trackTitles: {
    [manifest.tracks[0].id]: 'Clarinet Melody'
  }
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

Convert selected Audiotool tracks all the way to MusicXML. Optional `title` and `trackTitles` values override the exported score title and selected track/part names:

```bash
curl -X POST "http://localhost:3000/audiotool/convert" \
  -H "Content-Type: application/json" \
  -d '{"project":"https://beta.audiotool.com/studio?project=<project-id>","tracks":["<track-id>"],"mode":"score","title":"Project Sonata","trackTitles":{"<track-id>":"Clarinet Melody"}}' \
  --output audiotool.musicxml
```

Use `"mode":"parts"` for one MusicXML file per selected track, or `"mode":"both"` for a zip containing the full score and parts.

The direct converter applies an executable rhythm grammar to canonical MIDI, with approved notation rules for ordinary and dotted values, ties, rests, staccato cleanup, beams, triplets, compound meters, odd-meter fallback grouping, and 2/2-as-4/4 spelling. Key selection, contextual sharp/flat respelling, and arbitrary quintuplet/septuplet candidate generation are not implemented yet. Output currently declares C major and uses sharp pitch-class spellings.

## MusicXML to Audiotool

The authenticated web app also has a `MusicXML -> Audiotool` workflow. Upload a `.musicxml`, `.xml`, or `.mxl` score, analyze its parts, choose which parts to import, edit the imported track names, and create a new Audiotool project.

The importer reads MusicXML directly with lightweight Node libraries, including compressed `.mxl` files. It maps selected score parts to one Audiotool note track each, using basic Gakki instruments and mixer channels. It imports pitched notes and chords, ties, written-to-sounding transposition, timing expressed through MusicXML voices/backup/forward events, the first tempo, and the first time signature. When present, notation-only details such as slurs, dynamics, articulations, lyrics, repeats, grace notes, separate voice assignment, and percussion notation are reported as warnings and are not preserved yet.

Analyze an upload without creating a project:

```bash
curl -X POST http://localhost:3000/audiotool/import \
  -F "dryRun=true" \
  -F "file=@score.musicxml"
```

Create a new Audiotool project from selected parts:

```bash
curl -X POST http://localhost:3000/audiotool/import \
  -F 'audiotoolAuth={"accessToken":"...","refreshToken":"...","expiresAt":1893456000000,"clientId":"..."}' \
  -F "title=Imported Score" \
  -F 'parts=["part-1","part-2"]' \
  -F 'partTitles={"part-1":"Violin","part-2":"Cello"}' \
  -F "file=@score.musicxml"
```

For scripts, you can use an `Authorization: Bearer <PAT>` header or set `AUDIOTOOL_PAT`, the same as the existing Audiotool export endpoints.

## Runtime configuration

MIDI conversion and MusicXML import run entirely in Node. No desktop notation executable, virtual display, or Python runtime is required.

Useful environment variables:

- `MAX_UPLOAD_BYTES=52428800` controls the upload limit. Default: 50 MB.
- `JSON_BODY_LIMIT=1mb` controls JSON request size. Default: 1 MB.
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

Open `http://127.0.0.1:5173/`. The root route redirects to `/sign-in` or protected `/app` based on
auth state. The web service runs Vite in a Node container,
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

Register `http://127.0.0.1:5173/` as an Audiotool redirect URI, set `VITE_AUDIOTOOL_CLIENT_ID` in `.env`, then open `http://127.0.0.1:5173/`. The web container serves the React app, supports direct refreshes on `/sign-in` and `/app`, and proxies `/audiotool`, `/convert`, `/health`, and `/ready` to the API container.

Optional host port overrides:

```bash
API_PORT=3100 WEB_PORT=8180 docker compose up --build
```

Compose reads values from `.env` for settings such as `AUDIOTOOL_PAT` and upload limits. The API container is a Node-only image.

Stop both containers:

```bash
docker compose down
```

### Cloud Run + Cloudflare Pages deployment

The recommended production setup puts the lightweight Node API on Cloud Run and the static React app on Cloudflare Pages. See [`docs/deployment/cloud-run.md`](docs/deployment/cloud-run.md) for the ownership checklist, exact Cloudflare build settings, one-command API deployment, automatic Artifact Registry image cleanup, verification, and rollback steps.

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
