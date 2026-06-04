# MIDI to XML Tools

A monorepo for MIDI, MusicXML, and Audiotool conversion tools.

## Workspace layout

- `packages/midi-to-musicxml`: standalone MIDI to MusicXML conversion package with optional quantization and MuseScore support.
- `packages/audiotool-to-midi`: standalone Audiotool note-track to MIDI package. Audiotool extraction is intentionally separate from MIDI to MusicXML conversion.
- `apps/api`: Express API that wraps the packages for upload/conversion workflows.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Optionally create a local environment file:

   ```bash
   cp .env.example .env
   ```

3. Start the server:

   ```bash
   npm run start:api
   ```

4. Send a `POST` request to `/convert` with a `multipart/form-data` field named `file`.

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

Set `AUDIOTOOL_PAT` in `.env`, or send a bearer token in the request.

Fetch project details without opening the full DAW document:

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

Use `"mode":"parts"` for one MusicXML file per selected track, or `"mode":"both"` for a zip containing the full score and parts. Add `"includeMidi":true` to include the intermediate MIDI files in the zip.

## MuseScore configuration

The service searches for `mscore`, `mscore4`, `musescore`, `musescore3`, or `musescore4` in `PATH`. Set `MUSESCORE_BIN=/path/to/musescore` to use a specific executable.

MuseScore may need a display even when used from the CLI. On Linux with no `DISPLAY`, the service automatically wraps conversion in `xvfb-run -a`. The Docker image installs `xvfb` and `xauth` for this path.

Useful environment variables:

- `MUSESCORE_USE_XVFB=auto|always|never` controls virtual-display usage. Default: `auto`.
- `XVFB_RUN_BIN=/path/to/xvfb-run` points at a custom wrapper.
- `MAX_UPLOAD_BYTES=52428800` controls the upload limit. Default: 50 MB.
- `JSON_BODY_LIMIT=1mb` controls JSON request size. Default: 1 MB.
- `CONVERSION_TIMEOUT_MS=120000` controls the MuseScore timeout. Default: 120 seconds.
- `DEFAULT_QUANTIZATION_GRID=48` controls quantization when `?grid=` is not supplied.
- `AUDIOTOOL_PAT` optionally provides server-side Audiotool auth for the Audiotool API routes.

## Docker

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
