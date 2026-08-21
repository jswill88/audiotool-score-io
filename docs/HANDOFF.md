# Handoff

This is a Node 22 npm-workspaces monorepo for converting Audiotool note tracks and uploaded MIDI into notation-friendly MusicXML, and for importing MusicXML parts into Audiotool.

## Current Goal

The app now uses one lightweight, direct TypeScript notation path. MuseScore has been removed from the runtime, API, web UI, package surface, configuration, tests, and Docker images. The next product goal is to deploy the smaller build to Cloud Run plus Cloudflare Pages and evaluate it on real projects.

Reusable pieces:

- `packages/audiotool-to-midi`: Audiotool project/track inspection and MIDI rendering.
- `packages/midi-to-musicxml`: canonical multi-grid MIDI quantization, rhythm cleanup, and direct MusicXML generation.
- `packages/score-to-audiotool`: direct MusicXML/MXL parsing and Audiotool project/note-track writing.
- `apps/api`: Express API composing the packages.
- `apps/web`: React/Vite app for OAuth, export/import workflows, score viewing, and downloads.

The MIDI-to-MusicXML package cleans `dist` before every build, rebuilds during
`npm pack`/publish, and limits its published files to compiled `dist` output.

Read `AGENTS.md` for standing workflow instructions, `docs/TODO.md` for the shared checklist, and `docs/CODEMAP.md` for file navigation.

## Current Conversion Behavior

- Audiotool export first creates MIDI, then `quantizeMidiForNotation` chooses canonical timing from ordinary and triplet grid candidates.
- Triplet candidate scoring recognizes complete spans made from unequal triplet values or implicit MIDI rests, so patterns such as two tied eighth-triplet slots followed by one eighth triplet, or an eighth-triplet rest followed by two notes, remain triplets instead of being rounded to straight 32nd-note rhythms.
- The direct MusicXML writer applies the executable rhythm grammar for values, ties, rests, staccato cleanup, beams, triplets, compound meters, odd-meter grouping, clefs, stems, and final barlines.
- The web app and API no longer accept or display a notation-engine choice.
- Browser OAuth initialization is single-flight so React Strict Mode cannot redeem one authorization code twice. OAuth grant, PKCE, verifier, and stale-state failures are logged for developers but shown to users only as a concise prompt to try signing in again.
- The public sign-in page uses one wide content column. Its primary sign-in action sits in the app header, and a centered, borderless, single-column “Ready to get started?” CTA repeats the Audiotool sign-in action after both workflow comparisons; there is no separate introductory sign-in card.
- The public sign-in page demonstrates both workflows without authentication as explicit, border-light before/after sections beneath the headline “Move music between Audiotool and notation.” Standardized media frames carry the visual hierarchy while source/result audio links remain quiet secondary actions. The export example pairs a captured Audiotool Studio project with its generated notation; a compact poster opens the bundled 21-second recording in a click-to-play modal. The import example shows notation generated from the bundled three-part MusicXML score beside a captured Audiotool Studio project created from it. The actual converter remains behind Audiotool sign-in.
- Authenticated workspaces retain their compact operational layout while adopting the landing page’s hierarchy: a shorter authenticated header, slightly wider major-panel gaps, flatter project/track/part lists with shared list surfaces and selected-row accents, quieter result tabs, and a simplified score-viewer header and media frame.
- The export options show output mode plus a Quantize toggle only; quantization grid choice remains automatic and is not displayed as a separate control.
- `POST /convert` converts uploaded MIDI directly. `quantize=false` bypasses canonical quantization.
- `/ready` returns `{"status":"ready","converter":"direct"}` and has no external-binary readiness dependency.
- Page actions explicitly declare their sequential keyboard focus position so buttons, links, fields, checkboxes, and radio groups remain reachable even in browsers that omit controls with an implicit tab position. The Score/Parts/Both radio group and Score/XML tabs use standard roving focus: Tab enters each group once and arrow keys move between its options. Audiotool track rows and MusicXML import part rows expose named native checkboxes in the keyboard tab order. Track export names and imported part names use the same pencil-based inline editor, keep the pencil directly beside the displayed title, and expand to a full-width field while editing. Both lists show visible per-control focus. A completed project inspection moves focus into Tracks once. Choosing a score file starts MusicXML analysis immediately, and successful analysis moves focus into Parts once; merely refreshing projects does not move focus.
- The Audiotool projects list is height-capped and scrolls internally so accounts with many projects do not push the rest of the export workflow offscreen.
- Audiotool track rows and MusicXML import part rows use minimum heights but grow with wrapped labels, export names, metadata, and warning text so dense content stays visible.
- The editable score title in the Tracks header uses a wider responsive field so moderately long project titles remain visible while editing.
- The MusicXML import layout mirrors export more closely: the Audiotool project title occupies the same header position in Parts as the score title in Tracks, and Create Project sits in a bottom action bar where Convert appears in the export flow.
- Tracks and Parts use the same centered, patterned empty-list state before a project or score is selected.
- Interactive buttons have a subtle pointer-hover treatment across shared command, primary, icon, file, edit, and result-tab controls; disabled controls do not react, and hover-only styling is limited to hover-capable devices.
- In simple meters, direct note spelling splits short offbeat values smaller than one spelling beat when they cross a beat boundary. Dotted quarters and offbeat quarters remain intact across ordinary beat boundaries but split when they cross a meter-group/measure-subsection boundary; note splits are tied and rest splits remain separate.
- Nonstandard sub-beat durations are split into conventional chunks before serialization instead of being emitted as one raw duration with a misleading fallback note type.
- A scoped 2/4/equivalent-group sixteenth-level exception spells `16n | 8n | 8n | dotted 8n` as `16n | 8n | 16n ~ 16n | 16n ~ 8n` to reveal the quarter-note beat and apply the diminished offbeat sustain rule.
- A related 2/4/equivalent-group exception spells `dotted 8n | dotted 8n | 8n` as `dotted 8n | 16n ~ 8n | 8n` so the second dotted eighth exposes the quarter-note beat boundary.
- In simple `/4` meters, two-beat primary beams are reserved for groups made entirely of plain eighth notes; groups containing rests, dotted values, or sixteenths restart the primary beam at each quarter-note beat while preserving unsyncopated sixteenth pairs inside the beat.
- Within one simple beat, an ordinary eighth followed by a complete three-note sixteenth-triplet group shares one primary beam while retaining the triplet notation on the three tuplet notes.
- Direct MusicXML omits the tuplet bracket only for an evenly valued three-note triplet under one continuous primary beam. Tuplets containing rests, mixed values, or an incomplete/interrupted primary beam keep an explicit bracket; every group still shows its tuplet number.
- Offbeat sustains consolidate an aligned standard-value remainder when possible; for example, `16n | dotted 8n ~ 4n ~ 4n` is written as `16n | dotted 8n ~ 2n` when the half note begins and ends at readable beat boundaries.
- The direct MusicXML writer chooses constrained whole-part octave clefs for consistently extreme parts: treble `8va`/`15ma` for high parts and bass `8vb`/`15mb` for low parts. It never emits treble-down or bass-up octave clefs, and the package API can disable the whole-part feature with `octaveClefs: 'off'`.
- The direct MusicXML writer still emits conservative measure-local 8va/8vb octave-shift directions after whole-part clef selection. Contiguous runs of at least two note events shift when they are more than one octave outside the chosen staff; isolated note events shift only when they are more than two octaves outside the staff. Mixed-range chords, less-extreme isolated leaps, multi-voice measures, and cross-measure spans are left unmarked for now.
- Key selection and contextual enharmonic respelling remain future work. Output currently declares C major and uses the fixed black-key spellings C-sharp, E-flat, F-sharp, A-flat, and B-flat.
- Coherent quintuplet/septuplet candidate generation remains future work; supported triplets are written with explicit MusicXML tuplet notation.

The conversion implementation is organized by domain:

- `notation-ranker/`: active multi-grid candidate plans, candidate cleanup, event grouping, feature extraction/scoring, and ranker orchestration.
- `rhythm/rules.ts`: declarative templates and rule metadata.
- `rhythm/meter.ts`: meter families and grouping.
- `rhythm/spelling.ts`: duration spelling, matching, and tie chunks.
- `rhythm/cleanup.ts`: release/rest/tuplet/staccato transformations.
- `rhythm/types.ts`: shared contracts.
- `direct-musicxml/`: MIDI normalization, event construction, duration notation, beam/tuplet grouping, note serialization, and score serialization.

The unused fixed-grid `preprocessMidi` path, its grid defaults/types, `preprocessedPath` temp-file flow, API `preprocess` alias, and compatibility-only barrels were removed. Automatic in-memory canonical quantization is the only quantization path.

Runtime code and regression tests are the source of truth for rhythm behavior.
`docs/RHYTHM.md` records the durable design principles and module ownership
without duplicating the executable template catalog.

## MusicXML Import

`packages/score-to-audiotool` no longer converts scores through MIDI. It uses:

- `fast-xml-parser` for ordered MusicXML parsing.
- `adm-zip` for compressed `.mxl` archives.
- A narrow TypeScript adapter for parts, notes/chords, ties, written-to-sounding transposition, backup/forward timing, voices/staves used for timing and tie identity, tempo, meter, and percussion hints.

The importer is organized under `packages/score-to-audiotool/src/musicxml/` by archive reading, ordered-tree helpers, part parsing, and plan assembly. Audiotool MIDI export is similarly organized under `packages/audiotool-to-midi/src/render/`.

Import accepts `.musicxml`, `.xml`, and `.mxl`. It maps each selected score part to one Audiotool Gakki-backed note track. Part titles are normalized from MusicXML text, including common XML entity decoding for names such as `Bass & Cymbal`. Repeated import warnings are compacted in the web UI, such as grouping multiple percussion parts into one line. The first tempo and time signature are applied; later changes produce warnings. Unsupported slurs, dynamics, lyrics, repeats, grace notes, and separate voice assignments produce one concise warning only when the uploaded score contains them; detailed percussion mapping and other notation-only information are not imported yet.

## Deployment

The API Dockerfiles are Node-only and no longer install OS packages. Removed configuration includes `MUSESCORE_BIN`, `MUSESCORE_USE_XVFB`, `XVFB_RUN_BIN`, and `CONVERSION_TIMEOUT_MS`.

The API Dockerfiles use separate build/runtime stages so the final image excludes TypeScript tooling and web-only React/Vite/score-viewer dependencies. On the June 25, 2026 local Docker check, the Cloud Run image was about 287 MB versus about 879 MB for the previous image.

The primary deployment plan is now Cloud Run for the API plus Cloudflare Pages for the web app:

- `apps/api/Dockerfile.cloudrun` listens on `8080`.
- `CORS_ORIGINS` permits a separately hosted browser origin.
- `docs/deployment/cloud-run.md` contains the complete account, Cloudflare, API, OAuth, verification, and rollback sequence with user/Codex ownership.
- `scripts/deploy/cloud-run.sh` creates the Artifact Registry repository when needed, applies automatic cleanup, builds/pushes the API, deploys Cloud Run, checks health, and prints the final Cloudflare environment values.
- `.github/workflows/deploy-api.yml` tests, builds, and deploys the API on every push to `main` using keyless Google Workload Identity Federation. CI preserves the Cloud Run service's existing runtime environment and public-access policy; use the local deploy script when configuration changes are required.
- `docs/deployment/artifact-registry-cleanup-policy.json` deletes API images older than 14 days while retaining the five newest versions.
- The suggested starting shape is 1 CPU, 1 GiB RAM, concurrency 4, `min-instances=0`, and a conservative instance cap. Tune from real measurements.
- Cloudflare Pages should build from the repository root with `npm run build --workspace @midi-to-xml/web` and publish `apps/web/dist`.
- The Cloudflare Pages production origin is `https://audiotool-score-io.pages.dev`; it returned `HTTP/2 200` on June 26, 2026.
- The Cloud Run API is `https://audiotool-score-api-ne2gewecga-uw.a.run.app`. On June 26, 2026, `/health`, `/ready`, CORS preflight from the Cloudflare origin, uploaded MIDI conversion, `.musicxml` dry-run import, and `.mxl` dry-run import all returned `200`/`204` as expected.
- The deployed Pages JS inspected on July 29, 2026 includes `VITE_API_BASE_URL=https://audiotool-score-api-ne2gewecga-uw.a.run.app`; the production frontend, API `/health`, and API `/ready` all returned `200`. The authenticated browser workflow still needs the owner-run Audiotool OAuth and real-project checks.
- The old Oracle/DuckDNS materials remain archived under `docs/deployment/oracle-a1.md` and `scripts/oracle/`, but are no longer active TODO work.

## How To Run

```bash
npm install
cp .env.example .env
npm run start:api
npm run dev
```

Open `http://127.0.0.1:5173/`.

Docker development:

```bash
npm run docker:dev
npm run docker:dev:down
```

The Docker development stack bind-mounts the repository. Vite hot reloads web
changes, while `tsx watch` restarts the API automatically for edits under
`apps/api/src` or the three shared packages. Dependency changes still require
rebuilding the dev images and volumes.

Production-style local stack:

```bash
docker compose up --build
docker compose down
```

Health checks:

```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/ready
```

## Verification

The direct MusicXML package and direct MusicXML/MXL importer have regression coverage. Before handing off a change, run:

```bash
npm test
npm run check
```

Last verified August 21, 2026:

- `npm test`: 80 tests passed (34 Audiotool export, 42 direct MIDI/MusicXML, 3 score import, 1 web keyboard-focus regression).
- `npm run check`: all workspace typechecks/builds/syntax checks passed. Vite still warns that local Node 22.2.0 is below its preferred 22.12+ patch level and reports large score-viewer chunks, but the build exits green.
- Strict TypeScript unused-local and unused-parameter checks pass across every workspace.
- Both local and Cloud Run API Dockerfiles built successfully at about 287 MB.
- Container `/health` returned `ok`; `/ready` returned `{"status":"ready","converter":"direct"}`.
- Direct MIDI-to-MusicXML conversion and transposing-instrument MusicXML import both ran successfully inside the final runtime image.

For deployment/image changes, also build the API image and check both health endpoints:

```bash
docker build -f apps/api/Dockerfile.cloudrun -t midi-to-xml-api-check .
docker run --rm -d -p 127.0.0.1:8085:8080 --name midi-to-xml-api-check-run midi-to-xml-api-check
curl -sS http://127.0.0.1:8085/health
curl -sS http://127.0.0.1:8085/ready
docker stop midi-to-xml-api-check-run
```

## Useful Next Checks

1. Compare the new Docker image size and cold-start time with the old desktop-binary image.
2. Test real Audiotool export with one part, several parts, triplets, compound meter, and bass-clef material.
3. Test real MusicXML and MXL imports from more than one notation application.
4. Complete the Cloud Run plus Cloudflare Pages production checklist in `docs/TODO.md`.
5. Continue key-signature selection/enharmonic respelling and arbitrary tuplet work from `docs/TODO.md`.
