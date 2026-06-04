# Specification

- Create a backend Node service that can transform a MIDI file into a MusicXML file

## Conversion approach

1. Accept MIDI file uploads in the backend using `Express` and `multer`.
2. Optionally preprocess the MIDI with `@tonejs/midi` to improve timing before conversion.
   - parse MIDI events and note timing
   - quantize note start times and durations to musical grid values
   - allow quantization to be bypassed for users who want MuseScore to interpret the original timing
   - normalize small timing offsets and expressive timing artifacts
   - preserve tempo, time signature, and track/channel structure
3. Save the preprocessed MIDI to a temporary file.
4. Invoke MuseScore CLI from Node to perform the actual conversion:
   - `mscore -o output.musicxml preprocessed.mid`
   - allow `MUSESCORE_BIN` to point at a specific MuseScore executable
   - when running on Linux without `DISPLAY`, run MuseScore through `xvfb-run` by default
5. Return the generated `output.musicxml` to the client.

## Goals

- Keep the conversion flow simple by using MuseScore CLI.
- Improve human-readable rhythmic timing with a preprocessing quantization step.
- Support headless Docker/virtual-environment conversions where MuseScore still expects a display server.
- Avoid building a full MusicXML generator in Node unless needed later.
