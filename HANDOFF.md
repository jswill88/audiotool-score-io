# Handoff

This repo is a Node 22 npm-workspaces monorepo for exporting Audiotool projects to notation-friendly MusicXML.

## Current Goal

The product goal is a standalone web app where someone can sign in with Audiotool, pick a project, select exportable note tracks, convert them server-side, and view/download the resulting MusicXML in the browser.

The code is intentionally split so the conversion pieces can also be reused outside the web app:

- `packages/audiotool-to-midi`: Audiotool project/track inspection and MIDI rendering.
- `packages/midi-to-musicxml`: MIDI preprocessing plus MuseScore-based MusicXML conversion.
- `apps/api`: Express API that composes both packages.
- `apps/web`: React/Vite browser app for sign-in, project picking, track selection, conversion, and score viewing.

## Important Current State

As of this handoff, the latest MusicXML display cleanup is part of the intended committed baseline.

The main files involved are:

- `packages/midi-to-musicxml/src/musicxml.js`
- `packages/midi-to-musicxml/src/midi.js`
- `packages/midi-to-musicxml/src/index.js`
- `packages/midi-to-musicxml/test/helpers.js`
- `packages/midi-to-musicxml/test/midi.test.js`

What the latest cleanup does:

- Remove MusicXML `<movement-title>` so it does not display as an extra score title.
- Keep `<work-title>` for project/title metadata.
- Clean MuseScore-generated labels like `Piano, Track 1 - Lead` to `Track 1 - Lead`.
- For single-part exports, hide the left-side part label with `print-object="no"` and insert a bold `<direction><words>Track ...</words></direction>` above the first measure.
- Remove MuseScore `Pno.` part abbreviations from Audiotool track exports.
- Keep the ending double bar behavior.

Last verified commands:

```bash
npm test --workspace @midi-to-xml/midi-to-musicxml
npm run check --workspace @midi-to-xml/midi-to-musicxml
npm test
npm run check
docker compose up -d --build
curl -sS http://127.0.0.1:5173/health
```

The real Docker MuseScore conversion was also checked manually. It produced:

- `<work-title>Project Sonata</work-title>`
- no `<movement-title>`
- `<part-name print-object="no">Track 1 - Lead</part-name>`
- a visible `<words font-size="14" font-weight="bold">Track 1 - Lead</words>` direction above the first measure
- final `light-heavy` barline

## How To Run

Install:

```bash
npm install
```

Copy local env:

```bash
cp .env.example .env
```

Run local API and Vite dev app:

```bash
npm run start:api
npm run dev:web
```

Open:

```text
http://127.0.0.1:5173/
```

Run both services with Docker:

```bash
docker compose up --build
```

Stop Docker:

```bash
docker compose down
```

Health checks:

```bash
curl http://127.0.0.1:5173/health
curl http://127.0.0.1:3000/ready
```

## Ports And Proxying

Local dev:

- Vite web app: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:3000`
- Vite proxies API calls to the API during development.

Docker:

- `web` container serves built React app through nginx on container port `8080`.
- Host exposes web at `WEB_PORT`, default `5173`.
- `api` container runs Express on container port `3000`.
- Host exposes API at `API_PORT`, default `3000`.
- nginx proxies `/audiotool`, `/convert`, `/health`, and `/ready` to the API service.

## Audiotool Auth Notes

The browser app uses Audiotool browser OAuth through `@audiotool/nexus`. Set this in `.env`:

```text
VITE_AUDIOTOOL_CLIENT_ID=...
```

Register this redirect URI in the Audiotool app:

```text
http://127.0.0.1:5173/
```

`VITE_AUDIOTOOL_REDIRECT_URL` can stay blank so the app uses the current origin.

The current scope default is:

```text
VITE_AUDIOTOOL_SCOPE=project:write
```

This is slightly awkward because the app conceptually only reads projects. Earlier testing suggested the Nexus browser flow/opening project documents may require `project:write`, but this should be revisited if Audiotool supports a read-only flow for the same operations.

For server-side scripts or demos, `AUDIOTOOL_PAT` can be set instead, but the normal web app path is browser OAuth tokens sent to the API for server-side conversion.

## Conversion Flow

Browser:

1. User signs in with Audiotool.
2. User lists projects or enters a project URL/reference.
3. Browser asks API to inspect the project.
4. API uses `@midi-to-xml/audiotool-to-midi` to open the project and build a track manifest.
5. User selects tracks and options.
6. Browser sends tokens, project reference, track IDs, quantization options, and output mode to API.
7. API exports selected Audiotool note tracks to MIDI.
8. API converts MIDI files to MusicXML with `@midi-to-xml/midi-to-musicxml`.
9. Browser shows MusicXML text and an OpenSheetMusicDisplay score preview.

Output modes:

- `score`: combined score MusicXML.
- `parts`: separate MusicXML files per selected track.
- `both`: zip containing combined score plus parts.

`includeMidi: true` includes intermediate MIDI files in the zip.

Quantization:

- Default grid is `48`.
- Supported grids are `4`, `8`, `12`, `16`, `24`, `32`, `48`, `64`.
- Quantization can be bypassed with `quantize=false`.

## Track Handling

Current behavior:

- Track IDs remain the stable Audiotool entity IDs internally.
- UI and score labels use normalized visual order numbers like `Track 1 - Lead`.
- Empty tracks are disabled/not selectable for conversion.
- Drum-machine tracks, especially Beatbox 8/9, are skipped by default.
- Sampler, plugin, and unknown note tracks remain selectable with warnings.
- Unknown types are not automatically excluded because title/preset hints are weaker than explicit player data.

Known tradeoff:

- Audio/sample tracks are out of scope for direct export. Exporting those would require transcription, not MIDI extraction.

## MuseScore And Virtual Display

The API converts MIDI to MusicXML through MuseScore.

The Docker API image installs:

- MuseScore
- `xvfb`
- `xauth`

On Linux with no `DISPLAY`, virtual display handling defaults to:

```text
MUSESCORE_USE_XVFB=auto
```

That wraps MuseScore with `xvfb-run -a` when needed.

Useful settings:

```text
MUSESCORE_BIN=
MUSESCORE_USE_XVFB=auto
XVFB_RUN_BIN=xvfb-run
CONVERSION_TIMEOUT_MS=120000
DEFAULT_QUANTIZATION_GRID=48
```

## Current TODO Focus

From `TODO.md`, the most relevant remaining items are:

- Add space between tempo and part name, and part name and staff.
- Add a favicon.
- Decide whether default quantization should stay `48` or change to `24`.
- Find confusing code and refactor, especially long files.
- Add a loading indicator while the score display is being prepared.
- Future: score playback/follow-along, browser play controls, drum notation mapping, TypeScript.

The latest MusicXML display change may partly address the part-name spacing issue, but it should still be visually checked in the browser with a real project.

## Good Next-Session Checklist

1. Run `git status --short` and confirm the working tree state before making changes.
2. Open the app at `http://127.0.0.1:5173/` with Docker or local dev.
3. Test a real Audiotool project with one selected track and then multiple selected tracks.
4. Check whether OpenSheetMusicDisplay still draws any unwanted title from `<work-title>`.
5. Check visual spacing around tempo, the inserted track heading, and the first staff.
6. Adjust or commit follow-up changes based on that visual check.
7. Update `TODO.md` as items are confirmed.

## Useful Commands

```bash
git status --short
npm test
npm run check
docker compose up -d --build
docker compose ps
curl -sS http://127.0.0.1:5173/health
curl -sS http://127.0.0.1:3000/ready
docker compose logs -f api
docker compose logs -f web
docker compose down
```

## Suggested Prompt For A New Session

```text
Please read HANDOFF.md, README.md, TODO.md, and git status. Continue from the current committed state. First verify the app in Docker with a real Audiotool project if possible, then help decide whether the MusicXML part-heading approach needs any visual spacing adjustment.
```
