import type { NotationNote } from '../types.js';
import { generateCandidate } from './candidate.js';
import { gridFit } from './events.js';
import { extractFeatures, scoreFeatures } from './features.js';
import { rankerPlans } from './plans.js';
import type {
  RankerNote,
  RankerOptions
} from './types.js';

export function rankNotesForNotation(
  notes: NotationNote[],
  { ppq, timeSignature }: RankerOptions
) {
  const measureTicks = Math.round(
    ppq * timeSignature.numerator * (4 / timeSignature.denominator)
  );
  const grouped = new Map<number, NotationNote[]>();

  for (const note of notes) {
    const measureIndex = Math.floor(note.positionTicks / measureTicks);
    const measureNotes = grouped.get(measureIndex) ?? [];
    measureNotes.push(note);
    grouped.set(measureIndex, measureNotes);
  }

  return [...grouped.entries()]
    .sort(([left], [right]) => left - right)
    .flatMap(([measureIndex, measureNotes]) => {
      const measureStart = measureIndex * measureTicks;
      const localNotes = measureNotes.map((note) => ({
        ...note,
        localStart: note.positionTicks - measureStart
      }));
      const ranked = rankMeasure(localNotes, {
        measureTicks,
        ppq,
        timeSignature
      });

      return ranked.map(({ localStart, ...note }) => ({
        ...note,
        positionTicks: measureStart + localStart
      }));
    })
    .sort((left, right) => (
      left.positionTicks - right.positionTicks || left.pitch - right.pitch
    ));
}

function rankMeasure(
  notes: RankerNote[],
  {
    measureTicks,
    ppq,
    timeSignature
  }: RankerOptions & { measureTicks: number }
) {
  const tripletEvidence = gridFit(notes, ppq / 4) - gridFit(notes, ppq / 6);
  const candidates = rankerPlans.map((plan) => {
    const candidate = generateCandidate(notes, plan, {
      measureTicks,
      ppq
    });
    const features = extractFeatures(candidate, notes, {
      measureTicks,
      ppq,
      timeSignature,
      tripletEvidence
    });

    return {
      notes: candidate,
      score: scoreFeatures(features)
    };
  });

  return candidates.reduce((best, candidate) => (
    candidate.score < best.score ? candidate : best
  ), candidates[0]).notes;
}
