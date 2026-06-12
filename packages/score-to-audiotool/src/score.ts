import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import tonejsMidi from '@tonejs/midi';
import { convertWithMuseScore } from '@midi-to-xml/midi-to-musicxml';
import { ScoreImportValidationError } from './errors.js';
import type {
  BuildScoreImportPlanFromMidiOptions,
  BuildScoreImportPlanOptions,
  ScoreImportNote,
  ScoreImportPart,
  ScoreImportPlan,
  ScoreImportWarning
} from './types.js';

const { Midi } = tonejsMidi;

const audiotoolTicksPerBeat = 3840;
const defaultMidiPpq = 480;
const defaultTempoBpm = 120;
const defaultSignature = [4, 4] as const;
const scoreExtensions = new Set(['.musicxml', '.xml', '.mxl']);

export async function buildScoreImportPlan({
  inputPath,
  sourceName,
  title,
  midiPath,
  museScore
}: BuildScoreImportPlanOptions): Promise<ScoreImportPlan> {
  assertScoreInputPath(inputPath);

  let generatedDir: string | undefined;
  let outputPath = midiPath;

  if (!outputPath) {
    generatedDir = await fs.mkdtemp(path.join(os.tmpdir(), 'score-to-audiotool-'));
    outputPath = path.join(generatedDir, 'score.mid');
  }

  try {
    await convertWithMuseScore(inputPath, outputPath, museScore);
    return await buildScoreImportPlanFromMidiFile({
      inputPath: outputPath,
      sourceName: sourceName ?? path.basename(inputPath),
      title
    });
  } finally {
    if (generatedDir) {
      await fs.rm(generatedDir, { recursive: true, force: true });
    }
  }
}

export async function buildScoreImportPlanFromMidiFile({
  inputPath,
  sourceName,
  title
}: BuildScoreImportPlanFromMidiOptions): Promise<ScoreImportPlan> {
  const buffer = await fs.readFile(inputPath);
  const midi = new Midi(buffer);
  const ppq = midi.header.ppq || defaultMidiPpq;
  const warnings: ScoreImportWarning[] = [];
  const tempo = readFirstTempo(midi);
  const timeSignature = readFirstTimeSignature(midi);
  const parts: ScoreImportPart[] = [];
  let durationTicks = 0;

  if ((midi.header.tempos?.length ?? 0) > 1) {
    warnings.push({
      code: 'tempo-changes-flattened',
      message: 'Only the first tempo is imported into Audiotool in this version.'
    });
  }

  if ((midi.header.timeSignatures?.length ?? 0) > 1) {
    warnings.push({
      code: 'time-signature-changes-flattened',
      message: 'Only the first time signature is imported into Audiotool in this version.'
    });
  }

  midi.tracks.forEach((track, trackIndex) => {
    const notes = track.notes
      .map((note): ScoreImportNote => ({
        pitch: clampInteger(note.midi, 0, 127),
        positionTicks: midiTicksToAudiotoolTicks(note.ticks, ppq),
        durationTicks: Math.max(1, midiTicksToAudiotoolTicks(note.durationTicks, ppq)),
        velocity: clampNumber(note.velocity, 0, 1, 0.7)
      }))
      .filter((note) => note.durationTicks > 0)
      .sort((a, b) => a.positionTicks - b.positionTicks || a.pitch - b.pitch);

    if (notes.length === 0) {
      warnings.push({
        code: 'empty-midi-track',
        message: `MIDI track ${trackIndex + 1} had no notes and was skipped.`,
        trackIndex
      });
      return;
    }

    const id = `part-${parts.length + 1}`;
    const isPercussion = Boolean(track.instrument?.percussion) || track.channel === 9;
    const partTitle = cleanPartTitle(track.name) ||
      cleanPartTitle(track.instrument?.name) ||
      `Part ${parts.length + 1}`;

    for (const note of notes) {
      durationTicks = Math.max(durationTicks, note.positionTicks + note.durationTicks);
    }

    if (isPercussion) {
      warnings.push({
        code: 'percussion-basic-import',
        message: `${partTitle} appears to be percussion and will import as pitched notes until drum mapping is added.`,
        partId: id,
        trackIndex
      });
    }

    parts.push({
      id,
      title: partTitle,
      trackIndex,
      noteCount: notes.length,
      isPercussion,
      shouldImportByDefault: !isPercussion,
      notes
    });
  });

  warnings.push({
    code: 'musicxml-notation-not-imported',
    message: 'Notation-only details such as slurs, articulations, lyrics, dynamics, repeats, and voice splits are not imported yet.'
  });

  return {
    title: cleanPartTitle(title) || cleanPartTitle(midi.header.name) || titleFromSourceName(sourceName),
    sourceName,
    ppq,
    tempo,
    timeSignature,
    durationTicks: roundDurationToMeasure(durationTicks, timeSignature),
    parts,
    warnings
  };
}

function assertScoreInputPath(inputPath: string) {
  if (!inputPath) {
    throw new ScoreImportValidationError('inputPath is required.');
  }

  const ext = path.extname(inputPath).toLowerCase();

  if (!scoreExtensions.has(ext)) {
    throw new ScoreImportValidationError('Score import requires a .musicxml, .xml, or .mxl file.');
  }
}

function readFirstTempo(midi: InstanceType<typeof Midi>) {
  const tempo = midi.header.tempos?.[0];
  const bpm = roundDecimal(clampNumber(tempo?.bpm, 30, 1000, defaultTempoBpm), 3);

  return {
    bpm,
    sourceTicks: Math.max(0, Math.round(tempo?.ticks ?? 0))
  };
}

function readFirstTimeSignature(midi: InstanceType<typeof Midi>) {
  const signature = midi.header.timeSignatures?.[0];
  const values = Array.isArray(signature?.timeSignature)
    ? signature.timeSignature
    : defaultSignature;
  const numerator = clampInteger(values[0], 1, 32, defaultSignature[0]);
  const denominator = clampInteger(values[1], 1, 32, defaultSignature[1]);

  return {
    numerator,
    denominator,
    sourceTicks: Math.max(0, Math.round(signature?.ticks ?? 0))
  };
}

function midiTicksToAudiotoolTicks(ticks: number, ppq: number) {
  return Math.round((ticks / ppq) * audiotoolTicksPerBeat);
}

function roundDurationToMeasure(
  durationTicks: number,
  timeSignature: ScoreImportPlan['timeSignature']
) {
  const beatTicks = audiotoolTicksPerBeat * (4 / timeSignature.denominator);
  const measureTicks = Math.max(1, Math.round(beatTicks * timeSignature.numerator));
  return Math.max(measureTicks, Math.ceil(Math.max(1, durationTicks) / measureTicks) * measureTicks);
}

function cleanPartTitle(value: unknown) {
  const title = String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title || title.toLowerCase() === 'track') {
    return '';
  }

  return title.slice(0, 120);
}

function titleFromSourceName(sourceName: string | undefined) {
  const base = path.parse(sourceName || 'Imported Score').name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return base || 'Imported Score';
}

function clampInteger(value: unknown, min: number, max: number, fallback = min) {
  const number = Math.round(Number(value));

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, number));
}

function roundDecimal(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
