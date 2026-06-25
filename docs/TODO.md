# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Active

### Soon
- [ ] UI fixes
- [x] Clean up new code and audit large production modules, stale compatibility paths, and unused TypeScript symbols.
- [ ] pdf support
- [ ] tabbing support seems to be lost
- [x] Keep MIDI → MusicXML conversion in its own reusable package.
  - [ ] can there be a musicxml -> musicxml version, that cleans up dirty musicxml with the quantization option and rules?

### Direct conversion
- [x] Use one shared multi-grid quantizer to produce canonical MIDI before direct notation generation.
- [x] Organize notation ranking and rhythm grammar into focused folders, and remove the unused legacy fixed-grid quantizer surface.
- [x] Split direct MusicXML writing, Audiotool MIDI rendering, and MusicXML import into focused domain modules.
- [x] Convert the approved core rules in `docs/RHYTHM_TEMPLATES.md` into a declarative TypeScript rhythm grammar, meter-aware transformations, and ranked-direct regression tests.
- [ ] Add coherent quintuplet/septuplet candidate generation and dynamic MusicXML tuplet ratios; the executable grammar currently preserves supported triplets but the quantizer does not yet propose arbitrary tuplets.
- [x] Emit explicit MusicXML tuplet start/stop notation so quarter-, eighth-, and other supported triplets display their visible `3`, including groups containing rests.
- [x] Convert Audiotool data to MIDI first, then run the direct notation engine so conversion is reusable for uploaded MIDI and other apps.
- [x] Choose one clef per direct-export track from its median pitch and make stem direction use the active clef's middle line.

### Production Deployment: Cloud Run + Cloudflare Pages

Detailed instructions and ownership are in [`docs/deployment/cloud-run.md`](deployment/cloud-run.md).

- [x] **Codex:** Prepare the lightweight Cloud Run Docker image, API CORS support, deployment script, automatic Artifact Registry cleanup policy, and Cloudflare build settings.
- [ ] **You:** Create/select the Google Cloud project, enable billing, create a budget alert, and complete `gcloud auth login`.
- [ ] **You:** Connect the GitHub repository to Cloudflare Pages, use the documented monorepo build settings, and record the stable `*.pages.dev` production origin.
- [ ] **You:** Confirm the Audiotool client ID.
- [ ] **Codex:** Run `npm run deploy:cloud-run` after the Google account is authenticated and `PROJECT_ID`, `WEB_ORIGIN`, and `AUDIOTOOL_CLIENT_ID` are available.
- [ ] **You or Codex with Cloudflare CLI access:** Add the final Cloud Run URL to the Cloudflare Pages production environment variables and trigger the production rebuild.
- [ ] **You:** Register the final Cloudflare production URL as an Audiotool redirect URI.
- [ ] **Codex:** Verify Cloud Run health/readiness, production CORS, direct MIDI conversion, and MusicXML/MXL import.
- [ ] **Together:** Verify the real browser flow: sign in, load projects, inspect tracks, export MusicXML, analyze a score upload, and import selected parts.
- [ ] **Optional after launch — Codex:** Add keyless GitHub Actions API deployment using Google Workload Identity Federation.

### README Recruiter/Employer Polish

- [ ] Rewrite the README opening for recruiters and employers: state what Audiotool Score IO does, who it helps, and why it is technically interesting in the first few paragraphs.
- [ ] Add a concise `Project Highlights` section covering full-stack TypeScript, OAuth/API integration, MusicXML/MIDI processing, Docker deployment, accessibility work, and production operations.
- [ ] Add a `Live Demo` or `Production Deployment` section with the Cloudflare Pages URL, current status, and any auth/demo limitations explained plainly.
- [ ] Add a `How It Works` section that describes the main export/import flows without requiring the reader to understand the codebase first.
- [ ] Add a small architecture overview linking to `docs/CODEMAP.md` for deeper code navigation.
- [ ] Add screenshots or a short demo GIF once the production flow is stable enough to show confidently.
- [ ] Move dense local setup, curl examples, and low-level configuration farther down so the README scans well for non-technical first-pass readers while still serving developers.
- [ ] Add a short `Engineering Tradeoffs` section covering direct notation generation, Cloud Run/Cloudflare deployment, and known future improvements.

### Future Features

- [ ] Investigate API timeout/abort handling around Audiotool project inspect/open requests so bad PAT/project probes cannot wedge the API or make `/health` time out.
- [x] Have codemap link to referenced files
- [ ] Expand the notation-ranker experiment to ingest real MusicXML measures, generate candidates from the direct notation code, and train/evaluate a small learned ranker against the heuristic baseline.
- [ ] Add direct-export key selection and enharmonic respelling: default to C when no key is chosen, prefer key-consistent spellings, use sharps for otherwise ambiguous ascending lines and flats for descending lines, and rewrite pitch spelling without transposing sounding pitches.
- [ ] Add post-quantization grace-note classification on sufficiently fine-grid candidates: treat isolated notes no longer than one eighth of the beat near a principal note as candidates, but preserve repeated short-note runs as measured rhythm.
- [ ] Add a public `/demo` route for portfolio/recruiter access with an example track loaded by default, while keeping the main app/authenticated project flow behind sign-in.
- [ ] Improve MusicXML-to-Audiotool import beyond the MVP: split piano staves/voices, map percussion to drum devices, preserve tempo/time-signature changes, and add richer instrument/preset selection.
- [ ] Show the score following along during playback.
- [ ] Allow pressing play from the browser.
- [ ] Allow mapping drum notation
- [ ] Ability to choose which region?

### Stretch Ideas

- [ ] Explore title-based instrument defaults: infer an export instrument from track names with a deterministic synonym matcher, expose a dropdown override per track, keep the full score in concert pitch, and generate transposed individual parts for selected transposing instruments.
- [ ] Explore Spotify Basic Pitch for experimental audio-track transcription: audio stem/recording -> MIDI -> existing MusicXML conversion. Best aimed at isolated melodic or harmonic recordings, with clear caveats about transcription cleanup and lower reliability than direct Audiotool note-track export.

## Notes

## Completed

### Immediate

- [x] Update title to Audiotool Score IO now that the app imports and exports.
- [x] Ignore drum tracks by default, especially Beatbox 8/9. Machiniste and unknown note players warn but stay selectable by default.
- [x] Every track is "unknown type" which feels wrong.
- [x] If there are 0 notes in a track, we can disable it or ignore it. We can show it maybe, but not allow conversion. There's nothing to convert.
- [x] The score title should come from the name of the project.
- [x] The track numbers are still long floating point numbers. They should be the order, and should look like "1", "2". These are in the tracks and the score.
- [x] End music part with an ending double bar.
- [x] When switching between projects or starting a new conversion, the previous score is hidden.
- [x] add space between tempo and part name, and part name and staff
- [x] make a handoff document to a new session
- [x] Add a favicon.
- [x] Change the default quantization grid to 24.
- [x] Remove exact note counts from the UI/manifest; only track whether a part has 0 notes.
- [x] Remove the MIDI include checkbox from the web UI.
- [x] Remove header phase/status text and show errors contextually.

### Product Polish

- [x] Update the color scheme toward a modern DAW look with classical/Mozart hints.
- [x] Use visual track order numbers in labels instead of raw Audiotool entity ids.
- [x] Add editable score and track export titles that flow into MIDI metadata, MusicXML titles, MusicXML part names, and exported part filenames.
- [x] Find confusing code and refactor. Look especially for very long files
- [x] There should be a loading indicator when the score is being prepared to be displayed
- [x] Create link to project
- [x] Loading spinners for opening/inspecting projects
- [x] Sometimes parts appear to be merged into one double staff when they should be separate parts
- [x] Update logo colors

### Accessibility

- [x] Finish accessibility pass; labels, selected-state semantics, result tabs, live announcements, pane roles, contrast, reduced motion, and axe checks are done. Manual keyboard/screen-reader smoke tests remain below.
- [x] Add explicit accessible labels/help text for the project URL/ID input and quantization grid select; do not rely on placeholder text or icons alone.
- [x] Give active project and active result-file choices semantic selected state, such as `aria-pressed`, `aria-current`, or a native radio/listbox pattern.
- [x] Convert the Score/XML result switcher to an accessible tab pattern or native radio group, including selected state and panel labeling.
- [x] Add live status announcements for loading projects, inspecting tracks, conversion progress/completion, score render errors, and contextual errors.
- [x] Verify keyboard-only tab order through sign-in, project loading, project selection, track selection, options, conversion, result switching, file switching, and download.
- [x] Check WCAG AA color contrast for muted metadata text, inactive/active controls, warning/error chips, disabled controls, and focus states.
- [x] Review score preview and XML panes for clear names/roles, keyboard-scroll behavior, and a screen-reader-friendly fallback for rendered notation.
- [x] Respect reduced-motion preferences for loading spinners and any future animated score/playback states.
- [x] Run an automated axe audit after the above fixes; `npx --yes @axe-core/cli http://127.0.0.1:5174/ --exit` reports 0 violations.
- [x] Run a screen-reader smoke test after the above fixes; Chrome accessibility-tree smoke passed for roles, names, states, live announcements, tabs, file switching, and result panes. A live VoiceOver audio pass was not available from this session because macOS opened VoiceOver Quickstart instead of a usable reader session.

### Documentation

- [x] Add Docker start/stop instructions to the README.
- [x] Add standing agent guidance to keep `docs/TODO.md` and `docs/HANDOFF.md` current.

### Future Features

- [x] Add a MusicXML-to-Audiotool import workflow with a `score-to-audiotool` package, `/audiotool/import` route, MusicXML upload/analyze UI, part selection, imported track naming, and basic Gakki note-track project creation.
- [x] Add a direct MusicXML generation POC with side-by-side baseline comparison.
- [x] Add an offline notation-ranker starter experiment that generates synthetic messy note-track examples, candidate quantizations, heuristic scores, oracle labels, JSONL rows, and an HTML report.
- [x] Add first-pass beaming candidates plus nested `rhythm`, `beaming`, `voices`, and `stems` feature groups to the notation-ranker dataset.
- [x] Add schematic SVG staff previews to the notation-ranker report so clean, messy, and candidate rhythm/beaming/stem choices can be compared visually.
- [x] Add generated MusicXML plus OpenSheetMusicDisplay previews to the notation-ranker report, with lazy candidate-row rendering for visual review.
- [x] Put each notation-ranker example's full candidate table into a collapsed report drawer so the examples are easier to scan.
- [x] Add an `offbeat sustain` notation-ranker example and MusicXML tie splitting so off-beat sustained notes in 4/4 preserve visible beat boundaries.
- [x] Add first-pass 4/4 eighth-note beaming preference so four-eighth half-measure groups score better than two-eighth beat groups when appropriate.
- [x] Add a `release overhang` notation-ranker example plus `trim-rest-overhang` candidates so small extra note tails before clear rests can simplify to cleaner rests.
- [x] Add a `center-crossing half` notation-ranker example so beat-aligned unsyncopated half notes in 4/4 are not over-split at the measure center.
- [x] Correct clean-reference spelling for offbeat quarters, quarter-note triplets, and beams on adjacent eighth-note pieces created by readable tie splitting.
- [x] Add paired 3/4 and 6/8 notation-ranker report examples with meter-aware bar lengths, beat guides, MusicXML signatures, and contrasting eighth-note beam groups.
- [x] Improve notation-ranker candidate coverage and diagnostics with duration snapping, jitter reconciliation, chord clustering, direct clean-reference beam comparison, and separate coverage/ranking metrics.
- [x] Add compound-meter sustain spelling: split partial dotted-quarter boundary crossings in 6/8, preserve aligned whole compound-beat spans in 9/8, and verify the expanded 900-example stress set.
- [x] Integrate the notation ranker with the direct MusicXML writer and expose it as the app's export engine.
- [x] Put MusicXML-to-Audiotool parts into their own top-level `Parts` panel, matching the separate `Tracks` section in the export workflow.
- [x] Add `/sign-in` and protected `/app` routes. `/` redirects based on auth state, and the authenticated app header has a logout button that returns to `/sign-in`.
- [x] Upgrade remaining Audiotool package to TypeScript; shared TS config, `apps/web`, `apps/api`, and both reusable packages are done.
