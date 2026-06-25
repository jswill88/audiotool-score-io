# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Active

### Soon
- [ ] UI fixes
- [ ] Clean up new code
- [ ] Remove musescore path
- [ ] Find easier place to deploy newly smaller/faster app

### Direct conversion
- [ ] Unify MuseScore and ranked-direct quantization: raw MIDI should pass through one shared multi-grid quantizer, then both notation engines should consume the same canonical quantized MIDI.
- [ ] are some rules not working at different levels? Or do some sections need to be run over a couple of times? (16n -> 8n -> 4n)
- [x] Convert the approved core rules in `docs/RHYTHM_TEMPLATES.md` into a declarative TypeScript rhythm grammar, meter-aware transformations, and ranked-direct regression tests.
- [ ] Add coherent quintuplet/septuplet candidate generation and dynamic MusicXML tuplet ratios; the executable grammar currently preserves supported triplets but the quantizer does not yet propose arbitrary tuplets.
- [x] Emit explicit MusicXML tuplet start/stop notation so quarter-, eighth-, and other supported triplets display their visible `3`, including groups containing rests.
- [x] Convert to MIDI first, then run the selected notation engine so ranked direct conversion is reusable for uploaded MIDI and other apps.
- [x] Choose one clef per direct-export track from its median pitch and make stem direction use the active clef's middle line.

### Cloud Run Deployment Checklist

- [x] Add the ranked direct MusicXML engine to the app/API while retaining MuseScore as a comparison fallback.
- [x] Add API CORS configuration for a split web/API deployment with `CORS_ORIGINS`.
- [x] Add a Cloud Run API Dockerfile that listens on port `8080` and installs MuseScore with `xvfb`.
- [x] Add a Cloud Run deployment runbook under `docs/deployment/cloud-run.md`.
- [ ] Create or select a Google Cloud project with billing enabled and a budget alert.
- [ ] Build and push the API image to Artifact Registry using `apps/api/Dockerfile.cloudrun`.
- [ ] Deploy the API to Cloud Run with `min-instances=0`, `max-instances=1`, `concurrency=1`, and `CORS_ORIGINS` set to the web origin.
- [ ] Host the web build with `VITE_API_BASE_URL` pointed at the Cloud Run service URL.
- [ ] Register the hosted web origin as an Audiotool redirect URI.
- [ ] Verify the full hosted browser flow: sign in, load projects, inspect tracks, convert MusicXML, upload MusicXML, and import selected parts back to Audiotool.
- [ ] Prune old Artifact Registry image versions after deployment so the MuseScore image does not quietly accumulate storage cost.

### DuckDNS Oracle Deployment Checklist

- [x] Create an Oracle Cloud Always Free VM for the app, preferably an Ampere A1 instance with enough RAM for MuseScore conversions.
- [x] Add ingress rules in the Oracle security list/network security group for ports `80` and `443`; keep app internals such as API port `3000` closed to the public internet.
- [x] SSH into the VM, install Docker, Docker Compose, Git, and Caddy.
- [x] Clone this repo onto the VM and run `npm install` only if local validation/build debugging is needed; normal production launch should use Docker Compose.
- [x] Create a DuckDNS account, choose the subdomain `audiotool-score-io.duckdns.org`, and point it at the VM public IP.
- [x] Configure DuckDNS IP updates on the VM using the DuckDNS token, either with cron or a small systemd timer, so the subdomain stays current if the VM IP changes.
- [x] Wait for DNS to resolve, then confirm the VM sees the expected public IP with `dig audiotool-score-io.duckdns.org` or `nslookup audiotool-score-io.duckdns.org`.
- [x] Register or update the Audiotool developer application with the production redirect URL `https://audiotool-score-io.duckdns.org/`.
- [x] Create the production `.env` on the VM with `VITE_AUDIOTOOL_CLIENT_ID`, `VITE_AUDIOTOOL_REDIRECT_URL=https://audiotool-score-io.duckdns.org/`, `VITE_AUDIOTOOL_SCOPE=project:write`, `AUDIOTOOL_CLIENT_ID`, and the existing conversion settings.
- [x] Bind Docker Compose host ports to localhost where possible, for example `WEB_PORT=127.0.0.1:5173` and `API_PORT=127.0.0.1:3000`, so Caddy is the only public entrypoint.
- [x] Configure `/etc/caddy/Caddyfile` with `audiotool-score-io.duckdns.org { reverse_proxy 127.0.0.1:5173 }`.
- [x] Start or reload Caddy and confirm it obtains an HTTPS certificate for the DuckDNS subdomain.
- [x] Launch the app with `docker compose up -d --build` from the repo root on the VM.
- [x] Check container health with `docker compose ps` and `docker compose logs api web`.
- [x] Verify public endpoints: `https://audiotool-score-io.duckdns.org/`, `https://audiotool-score-io.duckdns.org/health`, and `https://audiotool-score-io.duckdns.org/ready`.
- [x] Add `scripts/oracle/a1-capacity-hunter.sh` to automate gentle OCI CLI retries for an A1 Flex replacement VM.
- [x] Configure `scripts/oracle/a1-capacity-hunter.env` locally with OCI tenancy, compartment, subnet, ARM image, and SSH public key values.
- [x] Start the local A1 capacity hunter as a macOS LaunchAgent using copied config under `~/.config/audiotool-score-io`.
- [ ] If returning to Oracle, choose a region/account strategy and restart the A1 capacity hunter only when it makes sense to wait for a `VM.Standard.A1.Flex` instance again.
- [ ] Test the full browser flow over HTTPS: sign in with Audiotool, load projects, inspect tracks, convert MusicXML, upload MusicXML, and import selected parts back to Audiotool.
- [ ] Document the chosen DuckDNS name, VM region/shape, env-var decisions, and final verification commands in `docs/HANDOFF.md` after the deployment is working.

#### Push-To-Main Redeploy Automation

- [ ] Create a dedicated deploy user or deploy SSH key for the Oracle VM instead of using a personal everyday SSH key.
- [ ] Add the deploy public key to the VM user's `~/.ssh/authorized_keys` and confirm that GitHub Actions can SSH into the VM non-interactively.
- [ ] Add GitHub repository secrets for `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, and the expected public app URL.
- [ ] Set `DEPLOY_SSH_KEY` to the full private key file contents, including the `-----BEGIN OPENSSH PRIVATE KEY-----` and `-----END OPENSSH PRIVATE KEY-----` lines, not the local key path such as `~/.ssh/midi_to_xml_deploy`.
- [ ] Keep production runtime secrets in the VM's `.env`; do not copy Audiotool tokens, DuckDNS tokens, or production `.env` values into the workflow file.
- [ ] Add a `.github/workflows/deploy.yml` workflow that runs on pushes to `main`, uses the SSH key, and deploys from the VM checkout.
- [ ] In the deploy workflow, run `git fetch --all`, reset or fast-forward the VM checkout to `origin/main`, and then run `docker compose up -d --build`.
- [ ] Add GitHub Actions concurrency so only one deploy to the VM can run at a time.
- [ ] After Compose restarts, have the workflow check `docker compose ps`, `https://audiotool-score-io.duckdns.org/health`, and `https://audiotool-score-io.duckdns.org/ready`.
- [ ] Decide on a rollback path, such as keeping the last known-good commit hash in the deploy log and manually redeploying that commit if health checks fail.
- [ ] Document the deploy workflow name, required GitHub secrets, and rollback command in `docs/HANDOFF.md` once automation is live.

### README Recruiter/Employer Polish

- [ ] Rewrite the README opening for recruiters and employers: state what Audiotool Score IO does, who it helps, and why it is technically interesting in the first few paragraphs.
- [ ] Add a concise `Project Highlights` section covering full-stack TypeScript, OAuth/API integration, MusicXML/MIDI processing, Docker deployment, accessibility work, and production operations.
- [ ] Add a `Live Demo` or `Production Deployment` section with the DuckDNS URL, current status, and any auth/demo limitations explained plainly.
- [ ] Add a `How It Works` section that describes the main export/import flows without requiring the reader to understand the codebase first.
- [ ] Add a small architecture overview linking to `docs/CODEMAP.md` for deeper code navigation.
- [ ] Add screenshots or a short demo GIF once the production flow is stable enough to show confidently.
- [ ] Move dense local setup, curl examples, and low-level configuration farther down so the README scans well for non-technical first-pass readers while still serving developers.
- [ ] Add a short `Engineering Tradeoffs` section covering MuseScore in Docker, the Oracle free-tier deployment choice, and known future improvements.

### Future Features

- [ ] Investigate API timeout/abort handling around Audiotool project inspect/open requests so bad PAT/project probes cannot wedge the API or make `/health` time out.
- [ ] Have codemap link to referenced files
- [ ] Expand the notation-ranker experiment to ingest real MusicXML measures, generate candidates from the direct notation code, and train/evaluate a small learned ranker against the heuristic baseline.
- [ ] Add direct-export key selection and enharmonic respelling: default to C when no key is chosen, prefer key-consistent spellings, use sharps for otherwise ambiguous ascending lines and flats for descending lines, and rewrite pitch spelling without transposing sounding pitches.
- [ ] Add post-quantization grace-note classification on sufficiently fine-grid candidates: treat isolated notes no longer than one eighth of the beat near a principal note as candidates, but preserve repeated short-note runs as measured rhythm.
- [ ] Remove the temporary macOS MuseScore app-bundle autodiscovery once local development no longer needs that convenience; production should use container-installed MuseScore.
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
- [x] Add a direct MusicXML generation POC that renders below the current MuseScore result for side-by-side comparison.
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
- [x] Integrate the notation ranker with the direct MusicXML writer and expose it as the app's default MuseScore-free export engine, with MuseScore still selectable for comparison.
- [x] Put MusicXML-to-Audiotool parts into their own top-level `Parts` panel, matching the separate `Tracks` section in the export workflow.
- [x] Add `/sign-in` and protected `/app` routes. `/` redirects based on auth state, and the authenticated app header has a logout button that returns to `/sign-in`.
- [x] Upgrade remaining Audiotool package to TypeScript; shared TS config, `apps/web`, `apps/api`, and both reusable packages are done.
