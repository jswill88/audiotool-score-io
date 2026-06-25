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

Read `AGENTS.md` for standing workflow instructions, `docs/TODO.md` for the shared checklist, and `docs/CODEMAP.md` for file navigation.

## Current Conversion Behavior

- Audiotool export first creates MIDI, then `quantizeMidiForNotation` chooses canonical timing from ordinary and triplet grid candidates.
- The direct MusicXML writer applies the executable rhythm grammar for values, ties, rests, staccato cleanup, beams, triplets, compound meters, odd-meter grouping, clefs, stems, and final barlines.
- The web app and API no longer accept or display a notation-engine choice.
- `POST /convert` converts uploaded MIDI directly. `quantize=false` bypasses canonical quantization.
- `/ready` returns `{"status":"ready","converter":"direct"}` and has no external-binary readiness dependency.
- Key selection and contextual sharp/flat respelling remain future work. Output currently declares C major and uses sharp pitch-class spellings.
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

`docs/RHYTHM_TEMPLATES.md` remains the human-readable source of truth.

## MusicXML Import

`packages/score-to-audiotool` no longer converts scores through MIDI. It uses:

- `fast-xml-parser` for ordered MusicXML parsing.
- `adm-zip` for compressed `.mxl` archives.
- A narrow TypeScript adapter for parts, notes/chords, ties, written-to-sounding transposition, backup/forward timing, voices/staves used for timing and tie identity, tempo, meter, and percussion hints.

The importer is organized under `packages/score-to-audiotool/src/musicxml/` by archive reading, ordered-tree helpers, part parsing, and plan assembly. Audiotool MIDI export is similarly organized under `packages/audiotool-to-midi/src/render/`.

Import accepts `.musicxml`, `.xml`, and `.mxl`. It maps each selected score part to one Audiotool Gakki-backed note track. The first tempo and time signature are applied; later changes produce warnings. Slurs, dynamics, lyrics, repeats, grace notes, separate voice assignments, detailed percussion mapping, and other notation-only information are not imported yet.

## Deployment

The API Dockerfiles are Node-only and no longer install OS packages. Removed configuration includes `MUSESCORE_BIN`, `MUSESCORE_USE_XVFB`, `XVFB_RUN_BIN`, and `CONVERSION_TIMEOUT_MS`.

The API Dockerfiles use separate build/runtime stages so the final image excludes TypeScript tooling and web-only React/Vite/score-viewer dependencies. On the June 25, 2026 local Docker check, the Cloud Run image was about 287 MB versus about 879 MB for the previous image.

The primary deployment plan is now Cloud Run for the API plus Cloudflare Pages for the web app:

- `apps/api/Dockerfile.cloudrun` listens on `8080`.
- `CORS_ORIGINS` permits a separately hosted browser origin.
- `docs/deployment/cloud-run.md` contains the complete account, Cloudflare, API, OAuth, verification, and rollback sequence with user/Codex ownership.
- `scripts/deploy/cloud-run.sh` creates the Artifact Registry repository when needed, applies automatic cleanup, builds/pushes the API, deploys Cloud Run, checks health, and prints the final Cloudflare environment values.
- `docs/deployment/artifact-registry-cleanup-policy.json` deletes API images older than 14 days while retaining the five newest versions.
- The suggested starting shape is 1 CPU, 1 GiB RAM, concurrency 4, `min-instances=0`, and a conservative instance cap. Tune from real measurements.
- Cloudflare Pages should build from the repository root with `npm run build --workspace @midi-to-xml/web` and publish `apps/web/dist`.
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

Last verified June 25, 2026:

- `npm test`: 64 tests passed (34 Audiotool export, 28 direct MIDI/MusicXML, 2 score import).
- `npm run check`: all workspace typechecks/builds/syntax checks passed.
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
