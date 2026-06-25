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
], options = {}) {
  const midi = new Midi();
  midi.header.setTempo(options.tempo ?? 120);

  if (options.timeSignature) {
    midi.header.timeSignatures.push({
      ticks: 0,
      timeSignature: options.timeSignature
    });
    midi.header.update();
  }

  const track = midi.addTrack();
  track.name = options.trackName ?? 'Test Piano';
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
