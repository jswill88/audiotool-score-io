import assert from 'node:assert/strict';
import fs from 'fs/promises';
import path from 'path';
import { test } from 'node:test';
import {
  applyMusicXmlFinalBarline,
  applyMusicXmlPartNames,
  applyMusicXmlTitle,
  assertAllowedQuantizationGrid,
  assertValidMidiFile,
  convertMidiToMusicXml,
  defaultQuantizationGrid,
  MidiValidationError,
  preprocessMidi
} from '@midi-to-xml/midi-to-musicxml';
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

test('defaultQuantizationGrid is 24', () => {
  assert.equal(defaultQuantizationGrid, 24);
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

test('applyMusicXmlTitle writes a work title and removes movement titles', () => {
  const xml = applyMusicXmlTitle(
    '<?xml version="1.0"?><score-partwise version="3.1"><movement-title>Draft</movement-title><part-list /></score-partwise>',
    'Moon & Stars <Demo>'
  );

  assert.match(xml, /<work-title>Moon &amp; Stars &lt;Demo&gt;<\/work-title>/);
  assert.doesNotMatch(xml, /<movement-title>/);
});

test('applyMusicXmlTitle removes movement titles when no title is requested', () => {
  const xml = applyMusicXmlTitle(
    '<?xml version="1.0"?><score-partwise version="3.1"><movement-title>Draft</movement-title><part-list /></score-partwise>',
    ''
  );

  assert.doesNotMatch(xml, /<movement-title>/);
  assert.doesNotMatch(xml, /<work-title>/);
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

test('applyMusicXmlPartNames formats multi-part Audiotool labels as names with track numbers', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Grand Piano</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>[\s\S]*<\/score-part>\s*<score-part id="P2">/);
  assert.match(xml, /<part-name>Grand Piano<\/part-name>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
});

test('applyMusicXmlPartNames strips non-piano MuseScore MIDI prefixes from Audiotool labels', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Lead 1 (square), Track 1 - Lead</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Grand Piano</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /Lead 1 \(square\), Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Ld\.<\/part-abbreviation>/);
  assert.match(xml, /<part-name>Grand Piano<\/part-name>/);
  assert.match(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>/);
});

test('applyMusicXmlPartNames uses requested part names without shifting missing overrides', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P2">
          <part-name>Piano, Track 2 - Pad</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
        <score-part id="P3">
          <part-name>Lead 1 (square), Track 3 - Hook</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
      </part-list>
    </score-partwise>
  `, ['Clarinet Melody', '', 'Tenor Line']);

  assert.match(xml, /<part-name>Clarinet Melody<\/part-name>/);
  assert.match(xml, /<part-name>Pad \(2\)<\/part-name>/);
  assert.match(xml, /<part-name>Tenor Line<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name>Hook \(3\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-abbreviation>/);
});

test('applyMusicXmlPartNames keeps single-part Audiotool labels in the default part-name position', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Piano, Track 1 - Lead</part-name>
          <part-abbreviation>Pno.</part-abbreviation>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1"></measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
  assert.doesNotMatch(xml, /Piano, Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Pno\.<\/part-abbreviation>/);
});

test('applyMusicXmlPartNames removes old generated single-part headings', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name print-object="no">Track 1 - Lead</part-name>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <direction placement="above">
            <direction-type>
              <words font-size="14" font-weight="bold">Track 1 - Lead</words>
            </direction-type>
          </direction>
        </measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Track 1 - Lead<\/words>/);
});

test('applyMusicXmlPartNames removes generated single-part headings with instrument prefixes', () => {
  const xml = applyMusicXmlPartNames(`
    <score-partwise version="3.1">
      <part-list>
        <score-part id="P1">
          <part-name>Lead 1 (square), Track 1 - Lead</part-name>
          <part-abbreviation>Ld.</part-abbreviation>
        </score-part>
      </part-list>
      <part id="P1">
        <measure number="1">
          <direction placement="above">
            <direction-type>
              <words font-size="14" font-weight="bold">Lead 1 (square), Track 1 - Lead</words>
            </direction-type>
          </direction>
        </measure>
      </part>
    </score-partwise>
  `);

  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /Lead 1 \(square\), Track 1 - Lead/);
  assert.doesNotMatch(xml, /<part-abbreviation>Ld\.<\/part-abbreviation>/);
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
  const xml = await fs.readFile(outputPath, 'utf8');
  assert.match(xml, /score-partwise/);
  assert.match(xml, /<part-name>Lead \(1\)<\/part-name>/);
  assert.doesNotMatch(xml, /<part-name\b[^>]*print-object="no"[^>]*>/);
  assert.doesNotMatch(xml, /<words\b[^>]*>Lead \(1\)<\/words>/);
  assert.doesNotMatch(xml, /Piano, Track 1 - Lead/);
  assert.doesNotMatch(xml, /<movement-title>/);
  assert.match(xml, /<bar-style>light-heavy<\/bar-style>/);
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
  assert.doesNotMatch(xml, /<movement-title>/);
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
