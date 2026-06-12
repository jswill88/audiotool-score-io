import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import tonejsMidi from '@tonejs/midi';
import { buildScoreImportPlanFromMidiFile, selectScoreImportParts } from '../dist/index.js';

const { Midi } = tonejsMidi;

test('buildScoreImportPlanFromMidiFile maps MIDI tracks to Audiotool-tick parts', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'score-to-audiotool-test-'));
  const midiPath = path.join(dir, 'source.mid');

  try {
    const midi = new Midi();
    midi.header.name = 'Quartet Sketch';
    midi.header.setTempo(90);
    midi.header.timeSignatures = [{
      ticks: 0,
      timeSignature: [3, 4],
      measures: 0
    }];

    const violin = midi.addTrack();
    violin.name = 'Violin';
    violin.addNote({
      midi: 64,
      ticks: 480,
      durationTicks: 240,
      velocity: 0.5
    });

    const drums = midi.addTrack();
    drums.name = 'Drums';
    drums.channel = 9;
    drums.addNote({
      midi: 36,
      ticks: 0,
      durationTicks: 120,
      velocity: 0.8
    });

    await fs.writeFile(midiPath, Buffer.from(midi.toArray()));

    const plan = await buildScoreImportPlanFromMidiFile({ inputPath: midiPath });

    assert.equal(plan.title, 'Quartet Sketch');
    assert.equal(plan.tempo.bpm, 90);
    assert.deepEqual(plan.timeSignature, {
      numerator: 3,
      denominator: 4,
      sourceTicks: 0
    });
    assert.equal(plan.parts.length, 2);
    assert.equal(plan.parts[0].title, 'Violin');
    assert.equal(plan.parts[0].notes[0].positionTicks, 3840);
    assert.equal(plan.parts[0].notes[0].durationTicks, 1920);
    assert.equal(plan.parts[1].isPercussion, true);
    assert.equal(plan.parts[1].shouldImportByDefault, false);

    const selected = selectScoreImportParts(plan);
    assert.deepEqual(selected.parts.map((part) => part.title), ['Violin']);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
