# Handoff

This repo is a Node 22 npm-workspaces monorepo for exporting Audiotool projects to notation-friendly MusicXML.

## Current Goal

The product goal is a standalone web app where someone can sign in with Audiotool, pick a project, select exportable note tracks, convert them server-side, and view/download the resulting MusicXML in the browser.

The code is intentionally split so the conversion pieces can also be reused outside the web app:

- `packages/audiotool-to-midi`: TypeScript Audiotool project/track inspection and MIDI rendering.
- `packages/midi-to-musicxml`: TypeScript MIDI preprocessing plus MuseScore-based MusicXML conversion.
- `packages/score-to-audiotool`: TypeScript MusicXML score import analysis plus Audiotool project/note-track writing.
- `apps/api`: Express TypeScript API that composes the reusable packages.
- `apps/web`: React/Vite TypeScript browser app for sign-in, project picking, track selection, MusicXML export, MusicXML import, and score viewing.

## Repo Process Notes

Read `AGENTS.md` for standing agent instructions. The handoff is useful for current-session context; durable workflow rules belong in `AGENTS.md`.

Keep this handoff current when changes affect behavior, setup/run commands, verification steps, known tradeoffs, or useful next-session context.

`TODO.md` now keeps active backlog items near the top and archives checked-off work in a `Completed` section at the bottom.

## Important Current State

As of this handoff, the latest MusicXML display cleanup is part of the intended committed baseline.

The main files involved are:

- `CODEMAP.md`
- `README.md`
- `tsconfig.base.json`
- `apps/web/tsconfig.json`
- `apps/web/src/types.ts`
- `apps/web/src/auth/audiotoolAuth.ts`
- `apps/web/src/hooks/useAudiotoolBrowserAuth.ts`
- `apps/api/tsconfig.json`
- `apps/api/src/types.ts`
- `apps/api/src/routes/audiotool.ts`
- `apps/api/src/audiotool/request.ts`
- `apps/api/src/audiotool/output.ts`
- `packages/audiotool-to-midi/tsconfig.json`
- `packages/audiotool-to-midi/src/render.ts`
- `packages/audiotool-to-midi/src/types.ts`
- `packages/audiotool-to-midi/test/export.test.js`
- `packages/midi-to-musicxml/tsconfig.json`
- `packages/midi-to-musicxml/src/musicxml.ts`
- `packages/midi-to-musicxml/src/midi.ts`
- `packages/midi-to-musicxml/src/musescore.ts`
- `packages/midi-to-musicxml/src/index.ts`
- `packages/midi-to-musicxml/src/types.ts`
- `packages/midi-to-musicxml/test/helpers.js`
- `packages/midi-to-musicxml/test/midi.test.js`
- `packages/score-to-audiotool/src/index.ts`
- `packages/score-to-audiotool/src/score.ts`
- `packages/score-to-audiotool/src/audiotool.ts`
- `packages/score-to-audiotool/src/types.ts`
- `packages/score-to-audiotool/test/score.test.js`

What the latest cleanup does:

- Remove MusicXML `<movement-title>` so it does not display as an extra score title.
- Keep `<work-title>` for project/title metadata.
- Clean MuseScore-generated part labels like `Piano, Track 1 - Lead` to `Lead (1)`.
- Clean MuseScore-generated part labels with non-piano MIDI instrument prefixes like `Lead 1 (square), Track 1 - Lead` to `Lead (1)`.
- Let users edit the score title and per-track export titles before conversion. The edited score title flows into exported MIDI/MusicXML title metadata, while edited track titles flow into MIDI track names, MusicXML part names, archive metadata, and separate-part filenames.
- Keep single-part labels in MusicXML's default `<part-name>` position instead of inserting a bold above-staff `<direction><words>...`.
- Remove generated MuseScore part abbreviations from Audiotool track exports.
- Stamp Audiotool-generated MIDI tracks with separate non-percussion channels and single-staff synth/pad programs before MuseScore import, so selected tracks stay independent parts instead of collapsing into a piano grand staff.
- Keep the ending double bar behavior.
- Add `CODEMAP.md` as a human-oriented navigation guide and link it from `README.md`.
- Keep `apps/api/src/routes/audiotool.ts` focused on route flow; Audiotool request/auth parsing now lives in `apps/api/src/audiotool/request.ts`, and conversion output/archive helpers live in `apps/api/src/audiotool/output.ts`.
- Guard Audiotool browser sign-in for missing `crypto.subtle.digest`; unsupported/insecure origins now show an in-app auth error instead of an uncaught login promise rejection.
- Complete the TypeScript migration across the app workspaces and reusable packages: the root shared TS config exists, `apps/web` has its own `tsconfig.json`, web source files are `.ts`/`.tsx`, and `apps/web` `check` runs `tsc --noEmit` before `vite build`.
- `apps/api` is TypeScript source compiled to ignored `dist/` output. Its `start` script runs `dist/server.js`, while root `start:api` and `dev:api` build the Audiotool-to-MIDI package, MIDI-to-MusicXML package, Score-to-Audiotool package, and API before launch.
- `packages/audiotool-to-midi` is now TypeScript source compiled to ignored `dist/` output. Its package entry points at `dist/index.js`, publishes `dist/index.d.ts`, and exports option/result/session/manifest types from `src/types.ts`.
- `packages/midi-to-musicxml` is now TypeScript source compiled to ignored `dist/` output. Its package entry points at `dist/index.js`, publishes `dist/index.d.ts`, and exports option/result types from `src/types.ts`.
- `packages/score-to-audiotool` is TypeScript source compiled to ignored `dist/` output. It converts MusicXML to MIDI through MuseScore for import analysis, parses score parts with `@tonejs/midi`, and writes selected parts into Audiotool as Gakki-backed note tracks.
- Docker API images build `@midi-to-xml/audiotool-to-midi`, `@midi-to-xml/midi-to-musicxml`, `@midi-to-xml/score-to-audiotool`, and `@midi-to-xml/api` during image creation, prune dev dependencies, and run the API workspace directly.
- The web app uses `apps/web/public/logo.svg` as both favicon and header brand mark. The mark combines a theme-matched brass treble-clef shape with a compact teal/brass DAW-style MIDI piano-roll grid on a graphite panel. `apps/web/index.html` now points at `/src/main.tsx`.
- The web app has a small client-side auth boundary: `/` redirects with history replacement based on Audiotool auth state, `/sign-in` is public, and `/app` is protected. The authenticated workspace has a header logout button that clears the browser auth state and returns to `/sign-in`. The API remains the real security boundary for project and conversion requests.
- The visual theme now uses black/dark graphite as the dominant app chrome color. Brass and teal remain accents, and the notation preview keeps its paper-like score surface.
- Keyboard focus now uses a stronger teal ring. Track rows show selected state on the full row while keyboard focus is indicated on the checkbox affordance to avoid clipped row outlines. The output mode segmented control is implemented as a native radio group with an accessible label.
- Active project choices now expose `aria-current`, and active converted-file buttons expose `aria-pressed`, so visual active states have matching semantics for assistive technology.
- The accessibility pass added explicit labels/help text for project and quantization inputs, ARIA tabs for the Score/XML switcher, polite live status announcements, named tab panels for score/XML panes, a screen-reader fallback note for rendered notation, reduced-motion handling for spinners, and an axe fix for the sidebar landmark.
- Keyboard-only tab order has been smoke-tested in Chrome with mocked Audiotool auth/API responses. The verified path covers sign-in, project loading, manual inspect, project selection, score-title editing, track checkbox selection, track export-title editing, output mode arrow-key switching, quantize/grid options, conversion, download, Score/XML result tabs, converted-file switching, and XML panel focus.
- Screen-reader smoke was checked through Chrome's accessibility tree with mocked Audiotool auth/API responses. The pass verified exposed roles, accessible names, checked/selected/pressed/disabled states, title-editor textbox names/values, live status announcement text, project list semantics, result tabs, converted-file buttons, and XML tab panel focus. A live VoiceOver audio pass could not be completed from this session because macOS opened VoiceOver Quickstart instead of a usable reader session.
- For future web UI work, treat accessibility as part of done: prefer native semantic controls, ensure every interactive element has an accessible name and state, verify keyboard order/focus, avoid color-only status signals, and update the `TODO.md` Accessibility checklist when new concerns appear.
- MusicXML-to-Audiotool import is now a first-pass workflow. The web app has a mode switch between `Audiotool -> MusicXML` and `MusicXML -> Audiotool`. Import accepts `.musicxml`, `.xml`, and `.mxl`; uncompressed XML is previewed in the existing score viewer, while `.mxl` can be analyzed/imported through the API without browser preview.
- `/audiotool/import` accepts multipart uploads. With `dryRun=true`, it returns a score import plan. Without `dryRun`, it requires Audiotool auth, creates a new Audiotool project, and writes selected parts as Gakki-backed note tracks with mixer channels, audio cables, one region per part, and MIDI-derived notes.
- The importer preserves note pitch/timing/duration/velocity plus the first tempo/time signature. It warns that slurs, articulations, dynamics, lyrics, repeats, voice splitting, later tempo/signature changes, and true drum mapping are not imported yet.
- The web workflow switcher now keeps export/import content on the same outer workspace width. The MusicXML-to-Audiotool page uses a single full-width rail, the workflow tabs have more horizontal padding, and the MusicXML upload control uses a left-aligned custom `Choose File` button with keyboard focus styling.
- Track export-name editing in the Audiotool-to-MusicXML flow is fixed: the hidden checkbox CSS in track rows is scoped to the checkbox input only, so the inline text editor input remains visible when the pencil button is clicked.
- Track and score-part lists now use native master checkboxes with indeterminate state for select-all behavior. Export select-all chooses only tracks with notes; import select-all chooses every detected score part.
- The track and score-part master checkboxes both sit below their section titles for matching list layout. Their visible label is `All`, with specific accessible labels for tracks and parts.
- The top-level conversion workflow selector now uses pressed buttons instead of a radio group. The output mode segmented control remains a native radio group.
- The MusicXML-to-Audiotool part list no longer shows per-part note counts in the UI; the import plan still carries note counts internally.
- Track and score-part lists use the same bounded internal scroll behavior so long lists do not push their surrounding action controls away.
- Empty source tracks in the MusicXML-to-Audiotool import plan now produce user-facing warnings like `Part 2 had no notes and was skipped.` instead of exposing the internal MIDI-track wording.

Last verified commands:

```bash
npx --yes @axe-core/cli http://127.0.0.1:5174/ --exit
npm run check --workspace @midi-to-xml/web
npm run build --workspace @midi-to-xml/audiotool-to-midi
npm test --workspace @midi-to-xml/audiotool-to-midi
npm run check --workspace @midi-to-xml/audiotool-to-midi
npm run build --workspace @midi-to-xml/midi-to-musicxml
npm test --workspace @midi-to-xml/midi-to-musicxml
npm run check --workspace @midi-to-xml/midi-to-musicxml
npm run build --workspace @midi-to-xml/score-to-audiotool
npm test --workspace @midi-to-xml/score-to-audiotool
npm run check --workspace @midi-to-xml/score-to-audiotool
npm run typecheck --workspace @midi-to-xml/api
npm run check --workspace @midi-to-xml/api
npm test
npm run typecheck
npm run check
node --input-type=module -e "const pkg = await import('@midi-to-xml/audiotool-to-midi'); console.log(typeof pkg.exportAudiotoolProjectToMidi, typeof pkg.inspectAudiotoolProject);"
node --input-type=module -e "await import('./apps/api/dist/app.js'); console.log('api dist import ok');"
docker build -f apps/api/Dockerfile -t midi-to-xml-api-audiotool-ts-check .
docker run --rm midi-to-xml-api-audiotool-ts-check node --input-type=module -e "await import('./apps/api/dist/app.js'); console.log('api image import ok');"
docker build -f Dockerfile -t midi-to-xml-root-audiotool-ts-check .
docker run --rm midi-to-xml-root-audiotool-ts-check node --input-type=module -e "await import('./apps/api/dist/app.js'); console.log('root image import ok');"
```

The real Docker MuseScore conversion was also checked manually. It produced:

- `<work-title>Project Sonata</work-title>`
- no `<movement-title>`
- `<part-name>Lead (1)</part-name>`
- no generated above-staff `<words>` direction for the part name
- final `light-heavy` barline

The score preview is intentionally reset when the selected project, active result, or active file changes. This prevents stale OpenSheetMusicDisplay output from overlapping the empty-state copy while a new project is being inspected or a new conversion is running.

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
npm run dev
```

`npm run start:api` builds `@midi-to-xml/audiotool-to-midi`, `@midi-to-xml/midi-to-musicxml`, `@midi-to-xml/score-to-audiotool`, and `@midi-to-xml/api` first because the reusable packages and API now run from ignored `dist/` output.

Open:

```text
http://127.0.0.1:5173/
```

Run Docker dev with Vite hot reload:

```bash
npm run docker:dev
```

Stop Docker dev:

```bash
npm run docker:dev:down
```

Run the production-style static web/API stack with Docker:

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

- `compose.dev.yml` runs the web service with Vite on container port `5173` and bind-mounts local source for hot reload.
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

Audiotool browser sign-in uses Web Crypto for OAuth. Open the app through `http://127.0.0.1:5173/`, `http://localhost:5173/`, or HTTPS. Insecure LAN or `0.0.0.0` origins may hide `crypto.subtle.digest`; the app now detects that and shows an auth-panel error.

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

Quantization:

- Default grid is `24`.
- Supported grids are `4`, `8`, `12`, `16`, `24`, `32`, `48`, `64`.
- Quantization can be bypassed with `quantize=false`.

## Track Handling

Current behavior:

- Track IDs remain the stable Audiotool entity IDs internally.
- UI track labels use normalized visual order numbers like `Track 1 - Lead`.
- Users can edit the score title and each track's export title in the track-selection panel before converting. Blank edits fall back to the detected project/track label.
- MusicXML part labels use player names with visual order suffixes like `Lead (1)`.
- Audiotool-generated MIDI assigns each selected track a distinct non-percussion channel and a single-staff synth/pad program; MIDI quantization preserves those import hints.
- Empty tracks are disabled/not selectable for conversion.
- Selectable track rows use the pointer cursor on hover; empty rows keep the not-allowed cursor.
- Track manifests/UI only track whether a track has notes; exact note counts are not exposed.
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
DEFAULT_QUANTIZATION_GRID=24
```

## Current TODO Focus

From `TODO.md`, the most relevant remaining items are:

- Future: score playback/follow-along, browser play controls, drum notation mapping, accessibility.

## Good Next-Session Checklist

1. Run `git status --short` and confirm the working tree state before making changes.
2. Read `TODO.md` and `AGENTS.md`.
3. Open the app at `http://127.0.0.1:5173/` with Docker or local dev.
4. Test a real Audiotool project with one selected track and then multiple selected tracks.
5. Check whether OpenSheetMusicDisplay still draws any unwanted title from `<work-title>`.
6. Check visual spacing around tempo, part names, and the first staff.
7. Adjust or commit follow-up changes based on that visual check.

## Useful Commands

```bash
git status --short
npm test
npm run check
npm run docker:dev
npm run docker:dev:down
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
Please read AGENTS.md, HANDOFF.md, README.md, TODO.md, and git status. Continue from the current committed state. First verify the app in Docker or Docker dev with a real Audiotool project if possible, then keep TODO.md updated as tasks are completed.
```
