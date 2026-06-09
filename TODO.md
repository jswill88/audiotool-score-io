# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Immediate

- [x] Ignore drum tracks by default, especially Beatbox 8/9. Machiniste and unknown note players warn but stay selectable by default.
- [x] Every track is "unknown type" which feels wrong.
- [x] If there are 0 notes in a track, we can disable it or ignore it. We can show it maybe, but not allow conversion. There's nothing to convert.
- [x] The score title should come from the name of the project.
- [x] The track numbers are still long floating point numbers. They should be the order, and should look like "1", "2". These are in the tracks and the score.
- [x] End music part with an ending double bar.
- [x] When switching between projects or starting a new conversion, the previous score is hidden.
- [x] add space between tempo and part name, and part name and staff
- [x] make a handoff document to a new session
- [ ] Add a favicon.
- [x] Change the default quantization grid to 24.
- [x] Remove exact note counts from the UI/manifest; only track whether a part has 0 notes.
- [x] Remove the MIDI include checkbox from the web UI.
- [x] Remove header phase/status text and show errors contextually.

## Product Polish

- [x] Update the color scheme toward a modern DAW look with classical/Mozart hints.
- [x] Use visual track order numbers in labels instead of raw Audiotool entity ids.
- [x] Find confusing code and refactor. Look especially for very long files
- [x] There should be a loading indicator when the score is being prepared to be displayed
- [x] Create link to project
- [x] Loading spinners for opening/inspecting projects
- [x] Sometimes parts appear to be merged into one double staff when they should be separate parts

## Documentation

- [x] Add Docker start/stop instructions to the README.
- [x] Add standing agent guidance to keep `TODO.md` and `HANDOFF.md` current.

## Future Features

- [ ] Show the score following along during playback.
- [ ] Allow pressing play from the browser.
- [ ] Allow mapping drum notation
- [ ] Upgrade to Typescript
- [ ] Check accessibility

## Notes
