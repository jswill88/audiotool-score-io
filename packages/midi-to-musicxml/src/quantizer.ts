import fs from 'fs/promises';
import tonejsMidi from '@tonejs/midi';
import { rankNotesForNotation } from './notation-ranker/index.js';
import type {
  NotationNote,
  TimeSignature
} from './types.js';

const { Midi } = tonejsMidi;
const minimumGridDivisor = 64;
const overlapReferenceGrid = 24;

type NormalizedNote = NotationNote & {
  noteOffVelocity: number;
  offTicks: number;
};

export async function quantizeMidiForNotation(
  inputPath: string,
  outputPath: string
) {
  const bytes = await fs.readFile(inputPath);
  const outputBytes = quantizeMidiBytesForNotation(bytes);
  await fs.writeFile(outputPath, Buffer.from(outputBytes));
}

export function quantizeMidiBytesForNotation(
  bytes: Uint8Array | ArrayBuffer
) {
  const midi = new Midi(bytes);
  const ppq = midi.header.ppq || 480;
  const timeSignature = readTimeSignature(midi.header.timeSignatures);
  const minimumDurationTicks = Math.max(1, ppq / minimumGridDivisor);
  const overlapGridTicks = Math.max(1, Math.round(ppq / (overlapReferenceGrid / 4)));

  for (const track of midi.tracks) {
    const notes = track.notes.map((note) => ({
      durationTicks: note.durationTicks,
      noteOffVelocity: note.noteOffVelocity,
      pitch: note.midi,
      positionTicks: note.ticks,
      velocity: note.velocity
    }));
    const ranked = rankNotesForNotation(notes, {
      ppq,
      timeSignature
    }).map((note) => ({
      ...note,
      noteOffVelocity: note.noteOffVelocity ?? 0,
      offTicks: note.positionTicks + note.durationTicks
    }));
    const withoutPitchOverlaps = removeSamePitchOverlaps(
      ranked,
      minimumDurationTicks
    );
    const canonical = preserveShortLegatoOverlaps(
      withoutPitchOverlaps,
      overlapGridTicks
    ).filter((note) => note.durationTicks >= minimumDurationTicks);

    track.notes.splice(0, track.notes.length);

    for (const note of canonical) {
      track.addNote({
        durationTicks: Math.max(1, Math.round(note.durationTicks)),
        midi: note.pitch,
        noteOffVelocity: note.noteOffVelocity,
        ticks: Math.max(0, Math.round(note.positionTicks)),
        velocity: note.velocity
      });
    }

    track.notes.sort((left, right) => (
      left.ticks - right.ticks ||
      left.midi - right.midi ||
      left.durationTicks - right.durationTicks
    ));

    if (track.endOfTrackTicks !== undefined) {
      track.endOfTrackTicks = Math.max(
        track.endOfTrackTicks,
        ...track.notes.map((note) => note.ticks + note.durationTicks)
      );
    }
  }

  return midi.toArray();
}

function removeSamePitchOverlaps(
  notes: NormalizedNote[],
  minimumDurationTicks: number
) {
  const normalized: NormalizedNote[] = [];
  const byPitch = new Map<number, NormalizedNote[]>();

  for (const note of notes) {
    const pitchNotes = byPitch.get(note.pitch) ?? [];
    pitchNotes.push(note);
    byPitch.set(note.pitch, pitchNotes);
  }

  for (const pitchNotes of byPitch.values()) {
    const cleaned: NormalizedNote[] = [];

    for (const note of pitchNotes.sort((left, right) => (
      left.positionTicks - right.positionTicks ||
      left.offTicks - right.offTicks
    ))) {
      const previous = cleaned.at(-1);

      if (!previous || note.positionTicks >= previous.offTicks) {
        cleaned.push({ ...note });
        continue;
      }

      if (note.positionTicks === previous.positionTicks) {
        previous.offTicks = Math.max(previous.offTicks, note.offTicks);
        previous.durationTicks = previous.offTicks - previous.positionTicks;
        continue;
      }

      previous.offTicks = note.positionTicks;
      previous.durationTicks = previous.offTicks - previous.positionTicks;

      if (previous.durationTicks < minimumDurationTicks) {
        cleaned.pop();
      }

      cleaned.push({ ...note });
    }

    normalized.push(...cleaned);
  }

  return normalized;
}

function preserveShortLegatoOverlaps(
  notes: NormalizedNote[],
  gridTicks: number
) {
  const chordStarts = [...new Set(notes.map((note) => note.positionTicks))]
    .sort((left, right) => left - right);

  return notes.map((note) => {
    const nextStart = chordStarts.find((start) => start > note.positionTicks);

    if (nextStart === undefined) {
      return note;
    }

    const cross = note.offTicks - nextStart;
    const onsetInterval = nextStart - note.positionTicks;

    if (cross > 0 && cross < onsetInterval / 2 && cross < gridTicks / 2) {
      return {
        ...note,
        durationTicks: nextStart - note.positionTicks,
        offTicks: nextStart
      };
    }

    return note;
  });
}

function readTimeSignature(
  signatures: Array<{ timeSignature: readonly number[] }>
): TimeSignature {
  const [numerator, denominator] = signatures[0]?.timeSignature ?? [4, 4];

  return {
    numerator: Number.isFinite(numerator) && numerator > 0 ? numerator : 4,
    denominator: Number.isFinite(denominator) && denominator > 0 ? denominator : 4
  };
}
