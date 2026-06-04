import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import tonejsMidi from '@tonejs/midi';

const { Midi } = tonejsMidi;

export async function createTempDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'midi-to-musicxml-test-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });
  return dir;
}

export async function writeMidiFile(filePath, notes = [
  { midi: 60, ticks: 0, durationTicks: 480, velocity: 0.8 }
]) {
  const midi = new Midi();
  midi.header.setTempo(120);

  const track = midi.addTrack();
  track.name = 'Test Piano';
  track.instrument.number = 0;

  notes.forEach((note) => {
    track.addNote(note);
  });

  await fs.writeFile(filePath, Buffer.from(midi.toArray()));
}

export async function readMidiNotes(filePath) {
  const midi = new Midi(await fs.readFile(filePath));
  return midi.tracks.flatMap((track) => track.notes).map((note) => ({
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks,
    velocity: note.velocity
  }));
}

export async function writeExecutable(filePath, content) {
  await fs.writeFile(filePath, content, { mode: 0o755 });
  await fs.chmod(filePath, 0o755);
}

export async function writeFakeMuseScore(filePath, logPath) {
  await writeExecutable(filePath, `#!/bin/sh
output=""
input=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o)
      shift
      output="$1"
      ;;
    *)
      input="$1"
      ;;
  esac
  shift
done
printf "%s" "$input" > "${logPath}"
printf "%s\\n" "<?xml version=\\"1.0\\"?><score-partwise version=\\"3.1\\"></score-partwise>" > "$output"
`);
}
