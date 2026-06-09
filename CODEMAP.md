# Code Map

Use this as the first stop when deciding where a change belongs.

## Runtime Flow

1. `apps/web` signs in with Audiotool, lists or opens a project, selects tracks, and requests conversion.
2. `apps/api` receives the request, opens the Audiotool project server-side, exports MIDI, converts it to MusicXML, and returns a file or zip.
3. `packages/audiotool-to-midi` owns Audiotool document inspection and MIDI rendering.
4. `packages/midi-to-musicxml` owns MIDI validation/preprocessing, MuseScore invocation, and post-processing generated MusicXML.

## Top-Level Workspaces

- `apps/web`: React/Vite browser app.
- `apps/api`: Express API that composes the reusable packages.
- `packages/audiotool-to-midi`: Reusable Audiotool-to-MIDI package.
- `packages/midi-to-musicxml`: Reusable MIDI-to-MusicXML package.

## API Guide

- `apps/api/src/app.js`: Express app composition and route mounting.
- `apps/api/src/routes/audiotool.js`: HTTP route flow for project listing, inspection, and conversion.
- `apps/api/src/audiotool/request.js`: Audiotool auth, request parsing, query/body option normalization, and request validation.
- `apps/api/src/audiotool/output.js`: Audiotool conversion work directories, MusicXML output files, zip archives, project serialization, and output names.
- `apps/api/src/routes/convert.js`: Generic uploaded-MIDI conversion endpoint.
- `apps/api/src/config/env.js`: Environment variables and defaults.
- `apps/api/src/utils`: Shared query, response, and file helpers.

## Audiotool-To-MIDI Package

- `src/session.js`: Audiotool SDK sessions and project open/inspect helpers.
- `src/project-reference.js`: Accepted project reference formats and normalization.
- `src/entities.js`: Audiotool/Nexus entity access helpers.
- `src/tracks.js`: Track manifest construction, track selection, region/note lookup, tempo, and time signature extraction.
- `src/notation-classification.js`: Device-type classification for notation export defaults and warnings.
- `src/render.js`: MIDI export orchestration, track filtering, warning collection, note-region expansion, and MIDI file creation.
- `src/ticks.js`: Audiotool tick to MIDI tick conversion.

## MIDI-To-MusicXML Package

- `src/midi.js`: MIDI file validation, optional quantization, conversion orchestration, and generated-file cleanup.
- `src/musescore.js`: MuseScore binary discovery and command execution, including virtual display wrapping.
- `src/musicxml.js`: MusicXML post-processing for titles, part labels, generated headings, abbreviations, and final barlines.
- `src/defaults.js`: Supported quantization grids, MuseScore command candidates, virtual display modes, and timeouts.

## Web App Guide

- `apps/web/src/App.jsx`: Top-level app state and workflow handlers.
- `apps/web/src/api/audiotool.js`: Browser API client for Audiotool project and conversion routes.
- `apps/web/src/hooks/useAudiotoolBrowserAuth.js`: Audiotool browser OAuth lifecycle and token export for the API.
- `apps/web/src/components/projects`: Sign-in, project listing, and project selection UI.
- `apps/web/src/components/tracks`: Track manifest, selection, mode, and quantization controls.
- `apps/web/src/components/results`: File tabs, MusicXML text, download link, and score preview.
- `apps/web/src/components/layout`: App shell/header/sidebar structure.
- `apps/web/src/styles/base.css`: Global visual language and shared element styling.

## Shared Project Docs

- `README.md`: User-facing setup, usage, API examples, Docker instructions, and runtime configuration.
- `TODO.md`: Shared product/backlog checklist.
- `HANDOFF.md`: Current project state, recent decisions, verification commands, and next-session notes.
- `AGENTS.md`: Standing workflow instructions for coding agents.
