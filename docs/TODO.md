# TODO

Immediate issues, product polish, and later ideas for the Audiotool to MusicXML app.

## Open

### Conversion And Notation

- [ ] Add coherent quintuplet/septuplet candidate generation and dynamic MusicXML tuplet ratios; the executable grammar currently preserves supported triplets but the quantizer does not yet propose arbitrary tuplets.
- [ ] Decide when repeated long-short eighth-note pairs should be represented as swing rather than explicit tuplets, and add an executable interpretation rule if needed.
- [ ] Add explicit pickup/anacrusis support from source metadata or a user setting; do not infer a pickup from MIDI timing alone.
- [ ] Expand the notation-ranker experiment to ingest real MusicXML measures, generate candidates from the direct notation code, and train/evaluate a small learned ranker against the heuristic baseline.
- [ ] Add direct-export key selection and enharmonic respelling: default to C when no key is chosen, prefer key-consistent spellings, use sharps for otherwise ambiguous ascending lines and flats for descending lines, and rewrite pitch spelling without transposing sounding pitches.
- [ ] Add post-quantization grace-note classification on sufficiently fine-grid candidates: treat isolated notes no longer than one eighth of the beat near a principal note as candidates, but preserve repeated short-note runs as measured rhythm.
- [ ] Improve MusicXML-to-Audiotool import beyond the MVP: split piano staves/voices, map percussion to drum devices, preserve tempo/time-signature changes, and add richer instrument/preset selection.
- [ ] Allow mapping drum notation.
- [ ] Explore title-based instrument defaults: infer an export instrument from track names with a deterministic synonym matcher, expose a dropdown override per track, keep the full score in concert pitch, and generate transposed individual parts for selected transposing instruments.
- [ ] Explore Spotify Basic Pitch for experimental audio-track transcription: audio stem/recording -> MIDI -> existing MusicXML conversion. Best aimed at isolated melodic or harmonic recordings, with clear caveats about transcription cleanup and lower reliability than direct Audiotool note-track export.

### Product And UX

- [ ] Show the score following along during playback.
- [ ] Allow pressing play from the browser.
- [ ] Decide whether users should be able to choose which region to export/import.

### API, Deployment, And Operations

- [ ] Investigate API timeout/abort handling around Audiotool project inspect/open requests so bad PAT/project probes cannot wedge the API or make `/health` time out.

### Standalone Node Package

- [ ] Add package metadata for publication: license, repository, homepage, keywords, and supported Node version.
- [ ] Decide the final npm package name and whether it will use a public npm scope.
- [ ] Add an isolated consumer smoke test that installs the packed tarball and converts a sample MIDI file.
- [ ] Document installation and standalone file/byte API examples.
- [ ] Publish an initial npm release and verify installation from a separate project.
- [ ] Decide whether to provide a browser-safe bytes-only entry point separately from the Node file API.
