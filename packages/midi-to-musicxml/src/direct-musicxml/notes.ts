import type { Track } from '@tonejs/midi';
import type { OctaveClefMode } from '../types.js';
import type { RhythmArticulation } from '../rhythm/index.js';
import type {
  NotationNote,
  TimeSignature
} from '../types.js';
import {
  chooseClefForPitches,
  clefSpecFor
} from './clefs.js';
import type {
  Clef,
  MeasureEvent,
  NormalizedNote,
  ScorePart
} from './types.js';

const overlapReferenceGrid = 24;

export function buildScorePart(
  track: Track,
  index: number,
  {
    divisions,
    measureDuration,
    octaveClefs,
    partName,
    ppq
  }: {
    divisions: number;
    measureDuration: number;
    octaveClefs?: OctaveClefMode;
    partName?: string;
    ppq: number;
  }
): ScorePart {
  const notes = normalizeNotesForNotation(
    track.notes.map((note) => ({
      durationTicks: note.durationTicks,
      pitch: note.midi,
      positionTicks: note.ticks,
      velocity: note.velocity
    })),
    { ppq }
  );
  const events = splitNotesIntoMeasureEvents(notes, {
    divisions,
    measureDuration,
    ppq
  });
  const measureCount = Math.max(
    1,
    ...events.map((event) => event.measureNumber)
  );
  const measures = Array.from(
    { length: measureCount },
    () => [] as MeasureEvent[]
  );

  for (const event of events) {
    measures[event.measureNumber - 1].push(event);
  }

  return {
    id: `P${index + 1}`,
    name: partName?.trim() || track.name?.trim() || `Track ${index + 1}`,
    clef: chooseClef(notes, octaveClefs),
    measures
  };
}

export function normalizeNotesForNotation(
  notes: NotationNote[],
  { ppq }: { ppq: number }
) {
  const minimumDurationTicks = ppq / 64;
  const gridTicks = Math.max(
    1,
    Math.round(ppq / (overlapReferenceGrid / 4))
  );
  const normalizedNotes = notes
    .filter((note) => note.durationTicks >= minimumDurationTicks)
    .map((note) => ({
      ...note,
      offTicks: note.positionTicks + note.durationTicks
    }));
  const withoutPitchOverlaps = removeSamePitchOverlaps(
    normalizedNotes,
    minimumDurationTicks
  );

  return preserveShortLegatoOverlaps(withoutPitchOverlaps, gridTicks)
    .filter((note) => note.durationTicks >= minimumDurationTicks)
    .sort((left, right) => (
      left.positionTicks - right.positionTicks || left.pitch - right.pitch
    ));
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

function splitNotesIntoMeasureEvents(
  notes: NotationNote[],
  {
    divisions,
    measureDuration,
    ppq
  }: {
    divisions: number;
    measureDuration: number;
    ppq: number;
  }
) {
  const grouped = new Map<
    string,
    MeasureEvent & { measureNumber: number }
  >();

  for (const note of notes) {
    const start = sourceTicksToDivisions(note.positionTicks, ppq, divisions);
    const duration = Math.max(
      1,
      sourceTicksToDivisions(note.durationTicks, ppq, divisions)
    );
    let remaining = duration;
    let cursor = start;
    let segmentIndex = 0;

    while (remaining > 0) {
      const measureNumber = Math.floor(cursor / measureDuration) + 1;
      const measureStart = (measureNumber - 1) * measureDuration;
      const localStart = cursor - measureStart;
      const segmentDuration = Math.min(
        remaining,
        measureDuration - localStart
      );
      const key = `${measureNumber}:${localStart}:${segmentDuration}`;
      const event = grouped.get(key) ?? {
        measureNumber,
        start: localStart,
        duration: segmentDuration,
        articulations: new Set<RhythmArticulation>(),
        pitches: [],
        performedDuration: segmentDuration,
        tieStartPitches: new Set<number>(),
        tieStopPitches: new Set<number>()
      };

      event.pitches.push(note.pitch);

      if (segmentIndex > 0) {
        event.tieStopPitches.add(note.pitch);
      }

      if (remaining > segmentDuration) {
        event.tieStartPitches.add(note.pitch);
      }

      grouped.set(key, event);
      cursor += segmentDuration;
      remaining -= segmentDuration;
      segmentIndex += 1;
    }
  }

  return [...grouped.values()].sort((left, right) => (
    left.measureNumber - right.measureNumber ||
    left.start - right.start ||
    left.duration - right.duration ||
    Math.min(...left.pitches) - Math.min(...right.pitches)
  ));
}

export function stemDirectionForPitches(
  pitches: number[],
  clef: Clef
): 'down' | 'up' {
  const average = pitches.reduce((sum, pitch) => sum + pitch, 0) /
    Math.max(1, pitches.length);
  const middleLinePitch = clefSpecFor(clef).middleLinePitch;
  return average < middleLinePitch ? 'up' : 'down';
}

export function midiPitchToMusicXmlPitch(midiPitch: number) {
  const pitchClasses = [
    { step: 'C', alter: 0 },
    { step: 'C', alter: 1 },
    { step: 'D', alter: 0 },
    { step: 'E', alter: -1 },
    { step: 'E', alter: 0 },
    { step: 'F', alter: 0 },
    { step: 'F', alter: 1 },
    { step: 'G', alter: 0 },
    { step: 'A', alter: -1 },
    { step: 'A', alter: 0 },
    { step: 'B', alter: -1 },
    { step: 'B', alter: 0 }
  ];
  const normalized = Math.min(127, Math.max(0, Math.round(midiPitch)));
  const pitchClass = pitchClasses[normalized % 12];

  return {
    ...pitchClass,
    octave: Math.floor(normalized / 12) - 1
  };
}

function chooseClef(
  notes: NotationNote[],
  octaveClefs: OctaveClefMode = 'auto'
): Clef {
  return chooseClefForPitches(
    notes.map((note) => note.pitch),
    octaveClefs
  );
}

export function measureDurationDivisions(
  timeSignature: TimeSignature,
  divisions: number
) {
  return Math.max(
    1,
    Math.round(
      divisions *
      timeSignature.numerator *
      (4 / timeSignature.denominator)
    )
  );
}

function sourceTicksToDivisions(
  ticks: number,
  ppq: number,
  divisions: number
) {
  return Math.max(0, Math.round((ticks / ppq) * divisions));
}

export function readTimeSignature(
  signatures: Array<{ timeSignature: readonly number[] }>
): TimeSignature {
  const [numerator, denominator] = signatures[0]?.timeSignature ?? [4, 4];

  return {
    numerator: Number.isFinite(numerator) && numerator > 0 ? numerator : 4,
    denominator: Number.isFinite(denominator) && denominator > 0
      ? denominator
      : 4
  };
}
