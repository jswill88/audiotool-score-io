# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Active

### Future Features

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
- [x] Add standing agent guidance to keep `TODO.md` and `HANDOFF.md` current.

### Future Features

- [x] Add a MusicXML-to-Audiotool import workflow with a `score-to-audiotool` package, `/audiotool/import` route, MusicXML upload/analyze UI, part selection, imported track naming, and basic Gakki note-track project creation.
- [x] Add `/sign-in` and protected `/app` routes. `/` redirects based on auth state, and the authenticated app header has a logout button that returns to `/sign-in`.
- [x] Upgrade remaining Audiotool package to TypeScript; shared TS config, `apps/web`, `apps/api`, and both reusable packages are done.
