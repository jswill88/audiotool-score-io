import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import tonejsMidi from '@tonejs/midi';
import {
  allowedQuantizationGrids,
  defaultQuantizationGrid
} from './defaults.js';
import { MidiValidationError } from './errors.js';
import {
  writeMusicXmlFinalBarline,
  writeMusicXmlPartNames,
  writeMusicXmlTitle
} from './musicxml.js';
import { convertWithMuseScore } from './musescore.js';

const { Midi } = tonejsMidi;

function quantizeTick(value, grid, minimum = 0) {
  return Math.max(minimum, Math.round(value / grid) * grid);
}

export function assertAllowedQuantizationGrid(grid) {
  if (!Number.isInteger(grid) || !allowedQuantizationGrids.has(grid)) {
    throw new MidiValidationError('Quantization grid must be one of 4, 8, 12, 16, 24, 32, 48, or 64.');
  }
}

export async function assertValidMidiFile(filePath) {
  const handle = await fs.open(filePath, 'r');

  try {
    const header = Buffer.alloc(4);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);

    if (bytesRead !== header.length || header.toString('ascii') !== 'MThd') {
      throw new MidiValidationError('Uploaded file does not appear to be a valid MIDI file.');
    }
  } finally {
    await handle.close();
  }
}

export async function preprocessMidi(inputPath, outputPath, quantizationGrid = defaultQuantizationGrid) {
  assertAllowedQuantizationGrid(quantizationGrid);

  const buffer = await fs.readFile(inputPath);
  const midi = new Midi(buffer);
  const ppq = midi.header.ppq || 480;
  const gridTicks = Math.max(1, Math.round(ppq / (quantizationGrid / 4)));

  midi.tracks.forEach((track) => {
    track.notes.forEach((note) => {
      note.ticks = quantizeTick(note.ticks, gridTicks, 0);
      note.durationTicks = quantizeTick(note.durationTicks, gridTicks, gridTicks);
    });
    track.notes.sort((a, b) => a.ticks - b.ticks);
  });

  if (Array.isArray(midi.header.tempos)) {
    midi.header.tempos = midi.header.tempos.map((tempo) => ({
      bpm: tempo.bpm,
      ticks: quantizeTick(tempo.ticks, gridTicks, 0)
    }));
  }

  const outputBytes = midi.toArray();
  await fs.writeFile(outputPath, Buffer.from(outputBytes));
}

async function cleanupGeneratedFile(filePath) {
  if (!filePath) return;

  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup errors for generated intermediates.
  }
}

async function cleanupGeneratedDir(dirPath) {
  if (!dirPath) return;

  try {
    await fs.rmdir(dirPath);
  } catch {
    // Ignore cleanup errors for generated intermediate directories.
  }
}

export async function convertMidiToMusicXml({
  inputPath,
  outputPath,
  quantize = true,
  grid = defaultQuantizationGrid,
  preprocessedPath,
  museScore = {},
  title
}) {
  if (!inputPath) {
    throw new MidiValidationError('inputPath is required.');
  }

  if (!outputPath) {
    throw new MidiValidationError('outputPath is required.');
  }

  await assertValidMidiFile(inputPath);

  let generatedPreprocessedPath;
  let generatedPreprocessedDir;
  let resolvedPreprocessedPath;
  let convertPath = inputPath;

  try {
    if (quantize) {
      if (preprocessedPath) {
        resolvedPreprocessedPath = preprocessedPath;
      } else {
        generatedPreprocessedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'midi-to-musicxml-'));
        resolvedPreprocessedPath = path.join(generatedPreprocessedDir, 'preprocessed.mid');
      }

      generatedPreprocessedPath = preprocessedPath ? undefined : resolvedPreprocessedPath;
      await preprocessMidi(inputPath, resolvedPreprocessedPath, grid);
      convertPath = resolvedPreprocessedPath;
    }

    await convertWithMuseScore(convertPath, outputPath, museScore);
    await writeMusicXmlTitle(outputPath, title);
    await writeMusicXmlPartNames(outputPath);
    await writeMusicXmlFinalBarline(outputPath);

    return {
      inputPath,
      outputPath,
      quantized: quantize,
      preprocessedPath: quantize ? resolvedPreprocessedPath : undefined
    };
  } finally {
    await cleanupGeneratedFile(generatedPreprocessedPath);
    await cleanupGeneratedDir(generatedPreprocessedDir);
  }
}
