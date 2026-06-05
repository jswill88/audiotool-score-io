import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';
import {
  applyMusicXmlFinalBarline,
  applyMusicXmlTitle,
  assertAllowedQuantizationGrid,
  assertValidMidiFile,
  convertMidiToMusicXml,
  MidiValidationError,
  preprocessMidi
} from '../src/index.js';
import {
  createTempDir,
  readMidiNotes,
  writeFakeMuseScore,
  writeMidiFile
} from './helpers.js';

test('assertAllowedQuantizationGrid accepts supported grids and rejects unsupported grids', () => {
  assert.doesNotThrow(() => assertAllowedQuantizationGrid(48));
  assert.doesNotThrow(() => assertAllowedQuantizationGrid(12));

  assert.throws(
    () => assertAllowedQuantizationGrid(10),
    MidiValidationError
  );
});

test('assertValidMidiFile accepts MIDI headers and rejects non-MIDI files', async (t) => {
  const dir = await createTempDir(t);
  const midiPath = path.join(dir, 'valid.mid');
  const textPath = path.join(dir, 'invalid.mid');

  await writeMidiFile(midiPath);
  await fs.writeFile(textPath, 'not a midi file');

  await assert.doesNotReject(() => assertValidMidiFile(midiPath));
  await assert.rejects(
    () => assertValidMidiFile(textPath),
    MidiValidationError
  );
});

test('preprocessMidi snaps note starts and durations to the requested grid', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'quantized.mid');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 7, durationTicks: 14, velocity: 0.8 },
    { midi: 64, ticks: 123, durationTicks: 70, velocity: 0.8 }
  ]);

  await preprocessMidi(inputPath, outputPath, 16);

  const notes = await readMidiNotes(outputPath);
  assert.deepEqual(notes.map((note) => ({
    midi: note.midi,
    ticks: note.ticks,
    durationTicks: note.durationTicks
  })), [
    { midi: 60, ticks: 0, durationTicks: 120 },
    { midi: 64, ticks: 120, durationTicks: 120 }
  ]);
});

test('applyMusicXmlTitle writes work and movement titles', () => {
  const xml = applyMusicXmlTitle(
    '<?xml version="1.0"?><score-partwise version="3.1"><part-list /></score-partwise>',
    'Moon & Stars <Demo>'
  );

  assert.match(xml, /<work-title>Moon &amp; Stars &lt;Demo&gt;<\/work-title>/);
  assert.match(xml, /<movement-title>Moon &amp; Stars &lt;Demo&gt;<\/movement-title>/);
});

test('applyMusicXmlFinalBarline ends each part with a final barline', () => {
  const xml = applyMusicXmlFinalBarline(`
    <score-partwise version="3.1">
      <part-list />
      <part id="P1">
        <measure number="1"></measure>
        <measure number="2">
          <barline location="right"><bar-style>regular</bar-style></barline>
        </measure>
      </part>
      <part id="P2">
        <measure number="1"></measure>
      </part>
    </score-partwise>
  `);

  assert.equal(xml.match(/<bar-style>light-heavy<\/bar-style>/g)?.length, 2);
  assert.match(xml, /<part id="P1">[\s\S]*<measure number="2">[\s\S]*<bar-style>light-heavy<\/bar-style>[\s\S]*<\/measure>/);
  assert.match(xml, /<part id="P2">[\s\S]*<measure number="1">[\s\S]*<bar-style>light-heavy<\/bar-style>[\s\S]*<\/measure>/);
});

test('convertMidiToMusicXml can bypass quantization and send the original MIDI to MuseScore', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath);
  await writeFakeMuseScore(museScoreBin, logPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false,
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  assert.equal(result.quantized, false);
  assert.equal(result.preprocessedPath, undefined);
  assert.equal(await fs.readFile(logPath, 'utf8'), inputPath);
  assert.match(await fs.readFile(outputPath, 'utf8'), /score-partwise/);
  assert.match(await fs.readFile(outputPath, 'utf8'), /<bar-style>light-heavy<\/bar-style>/);
});

test('convertMidiToMusicXml can write a requested MusicXML title', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath);
  await writeFakeMuseScore(museScoreBin, logPath);

  await convertMidiToMusicXml({
    inputPath,
    outputPath,
    quantize: false,
    title: 'Project Sonata',
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /<work-title>Project Sonata<\/work-title>/);
  assert.match(xml, /<movement-title>Project Sonata<\/movement-title>/);
});

test('convertMidiToMusicXml uses a provided preprocessed path when quantization is enabled', async (t) => {
  const dir = await createTempDir(t);
  const inputPath = path.join(dir, 'input.mid');
  const outputPath = path.join(dir, 'output.musicxml');
  const preprocessedPath = path.join(dir, 'preprocessed.mid');
  const logPath = path.join(dir, 'musescore-input.log');
  const museScoreBin = path.join(dir, 'fake-mscore');

  await writeMidiFile(inputPath, [
    { midi: 60, ticks: 7, durationTicks: 14, velocity: 0.8 }
  ]);
  await writeFakeMuseScore(museScoreBin, logPath);

  const result = await convertMidiToMusicXml({
    inputPath,
    outputPath,
    preprocessedPath,
    grid: 16,
    museScore: {
      museScoreBin,
      virtualDisplayMode: 'never'
    }
  });

  assert.equal(result.quantized, true);
  assert.equal(result.preprocessedPath, preprocessedPath);
  assert.equal(await fs.readFile(logPath, 'utf8'), preprocessedPath);
  assert.deepEqual((await readMidiNotes(preprocessedPath)).map((note) => ({
    ticks: note.ticks,
    durationTicks: note.durationTicks
  })), [
    { ticks: 0, durationTicks: 120 }
  ]);
});
