# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Immediate

- [x] Ignore drum tracks by default, especially Beatbox 8/9. Machiniste and unknown note players warn but stay selectable by default.
- [x] Every track is "unknown type" which feels wrong.
- [x] If there are 0 notes in a track, we can disable it or ignore it. We can show it maybe, but not allow conversion. There's nothing to convert.
- [x] The score title should come from the name of the project.
- [x] The track numbers are still long floating point numbers. They should be the order, and should look like "1", "2". These are in the tracks and the score.
- [x] End music part with an ending double bar.
- [x] When switching between projects, the score from the previous project is not hidden.
- [ ] Add a favicon.
- [ ] Decide whether the default quantization grid should change to 24 or stay at 48.

## Product Polish

- [x] Update the color scheme toward a modern DAW look with classical/Mozart hints.
- [x] Use visual track order numbers in labels instead of raw Audiotool entity ids.
- [ ] Find confusing code and refactor. Look especially for very long files
- [ ] There should be a loading indicator when the score is being prepared to be displayed

## Documentation

- [x] Add Docker start/stop instructions to the README.

## Future Features

- [ ] Show the score following along during playback.
- [ ] Allow pressing play from the browser.
- [ ] Allow mapping drum notation
- [ ] Upgrade to Typescript

## Notes
