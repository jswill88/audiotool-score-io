# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Active

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
- [ ] Let the A1 capacity hunter run until Oracle creates a `VM.Standard.A1.Flex` instance, then migrate DuckDNS and the app to the new VM.
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

- [ ] Rewrite the README opening for recruiters and employers: state what Audiotool Score I/O does, who it helps, and why it is technically interesting in the first few paragraphs.
- [ ] Add a concise `Project Highlights` section covering full-stack TypeScript, OAuth/API integration, MusicXML/MIDI processing, Docker deployment, accessibility work, and production operations.
- [ ] Add a `Live Demo` or `Production Deployment` section with the DuckDNS URL, current status, and any auth/demo limitations explained plainly.
- [ ] Add a `How It Works` section that describes the main export/import flows without requiring the reader to understand the codebase first.
- [ ] Add a small architecture overview linking to `docs/CODEMAP.md` for deeper code navigation.
- [ ] Add screenshots or a short demo GIF once the production flow is stable enough to show confidently.
- [ ] Move dense local setup, curl examples, and low-level configuration farther down so the README scans well for non-technical first-pass readers while still serving developers.
- [ ] Add a short `Engineering Tradeoffs` section covering MuseScore in Docker, the Oracle free-tier deployment choice, and known future improvements.

### Future Features

- [ ] Investigate API timeout/abort handling around Audiotool project inspect/open requests so bad PAT/project probes cannot wedge the API or make `/health` time out.
- [ ] Put parts into separate section, like tracks is
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

- [x] Update title to Audiotool Score I/O now that the app imports and exports.
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
- [x] Add `/sign-in` and protected `/app` routes. `/` redirects based on auth state, and the authenticated app header has a logout button that returns to `/sign-in`.
- [x] Upgrade remaining Audiotool package to TypeScript; shared TS config, `apps/web`, `apps/api`, and both reusable packages are done.
