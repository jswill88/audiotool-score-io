import type {
  NotationNote,
  TimeSignature
} from './types.js';

type RankerOptions = {
  ppq: number;
  timeSignature: TimeSignature;
};

type RankerPlan = {
  id: string;
  grid: number;
  policy:
    | 'bridge-gaps'
    | 'duration-ceil-reconcile'
    | 'duration-snap-reconcile'
    | 'reconcile-jitter'
    | 'strict'
    | 'trim-overlaps'
    | 'trim-rest-overhang';
};

type RankerNote = NotationNote & {
  localStart: number;
};

type RankerEvent = {
  start: number;
  duration: number;
  pitches: number[];
};

const plans: RankerPlan[] = [
  { id: 'grid16-strict', grid: 16, policy: 'strict' },
  { id: 'grid16-bridge-gaps', grid: 16, policy: 'bridge-gaps' },
  { id: 'grid16-trim-overlaps', grid: 16, policy: 'trim-overlaps' },
  { id: 'grid16-reconcile-jitter', grid: 16, policy: 'reconcile-jitter' },
  { id: 'grid16-duration-snap-reconcile', grid: 16, policy: 'duration-snap-reconcile' },
  { id: 'grid16-duration-ceil-reconcile', grid: 16, policy: 'duration-ceil-reconcile' },
  { id: 'grid16-trim-rest-overhang', grid: 16, policy: 'trim-rest-overhang' },
  { id: 'grid24-strict', grid: 24, policy: 'strict' },
  { id: 'grid24-bridge-gaps', grid: 24, policy: 'bridge-gaps' },
  { id: 'grid24-reconcile-jitter', grid: 24, policy: 'reconcile-jitter' },
  { id: 'grid24-duration-snap-reconcile', grid: 24, policy: 'duration-snap-reconcile' },
  { id: 'grid24-duration-ceil-reconcile', grid: 24, policy: 'duration-ceil-reconcile' },
  { id: 'grid24-trim-rest-overhang', grid: 24, policy: 'trim-rest-overhang' },
  { id: 'grid32-strict', grid: 32, policy: 'strict' },
  { id: 'grid32-bridge-gaps', grid: 32, policy: 'bridge-gaps' },
  { id: 'grid32-reconcile-jitter', grid: 32, policy: 'reconcile-jitter' },
  { id: 'grid32-duration-snap-reconcile', grid: 32, policy: 'duration-snap-reconcile' },
  { id: 'grid32-duration-ceil-reconcile', grid: 32, policy: 'duration-ceil-reconcile' },
  { id: 'grid32-trim-rest-overhang', grid: 32, policy: 'trim-rest-overhang' },
  { id: 'grid48-strict', grid: 48, policy: 'strict' },
  { id: 'grid96-strict', grid: 96, policy: 'strict' }
];

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
    .sort((left, right) => left.positionTicks - right.positionTicks || left.pitch - right.pitch);
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
  const candidates = plans.map((plan) => {
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

function generateCandidate(
  notes: RankerNote[],
  plan: RankerPlan,
  {
    measureTicks,
    ppq
  }: {
    measureTicks: number;
    ppq: number;
  }
) {
  const unit = Math.max(1, Math.round(ppq / (plan.grid / 4)));
  const standardDurations = createStandardDurations(ppq);
  const adjusted = notes.map((note) => {
    const localStart = clamp(roundToUnit(note.localStart, unit), 0, measureTicks - unit);
    const crossesMeasure = note.localStart + note.durationTicks > measureTicks;
    const quantizedEndpointDuration = Math.max(
      unit,
      roundToUnit(note.localStart + note.durationTicks, unit) - localStart
    );
    const maximum = Math.max(
      unit,
      measureTicks - localStart,
      quantizedEndpointDuration
    );
    const duration = crossesMeasure
      ? quantizedEndpointDuration
      : plan.policy === 'duration-snap-reconcile'
      ? nearestStandardDuration(note.durationTicks, unit, maximum, standardDurations)
      : plan.policy === 'duration-ceil-reconcile'
        ? nextStandardDuration(note.durationTicks, unit, maximum, standardDurations)
        : clamp(
            quantizedEndpointDuration,
            unit,
            maximum
          );

    return {
      ...note,
      localStart,
      durationTicks: duration
    };
  });

  if (isReconcilePolicy(plan.policy)) {
    normalizeChordClusters(adjusted, unit, ppq);
  }

  const groups = groupEvents(adjusted);

  if (plan.policy === 'trim-rest-overhang') {
    trimRestOverhangs(adjusted, groups, {
      measureTicks,
      ppq,
      standardDurations,
      unit
    });
  }

  for (let index = 0; index < groups.length - 1; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];
    const groupEnd = Math.max(...group.noteIndexes.map((noteIndex) => (
      adjusted[noteIndex].localStart + adjusted[noteIndex].durationTicks
    )));
    const gap = next.start - groupEnd;

    if (plan.policy === 'bridge-gaps' && gap > 0 && gap <= unit) {
      for (const noteIndex of group.noteIndexes) {
        adjusted[noteIndex].durationTicks += gap;
      }
    }

    if (plan.policy === 'trim-overlaps' && gap < 0 && Math.abs(gap) <= unit) {
      for (const noteIndex of group.noteIndexes) {
        adjusted[noteIndex].durationTicks = Math.max(
          unit,
          next.start - adjusted[noteIndex].localStart
        );
      }
    }

    if (isReconcilePolicy(plan.policy) && Math.abs(gap) <= unit) {
      for (const noteIndex of group.noteIndexes) {
        adjusted[noteIndex].durationTicks = Math.max(
          unit,
          next.start - adjusted[noteIndex].localStart
        );
      }
    }
  }

  if (isReconcilePolicy(plan.policy) && groups.length > 0) {
    const finalGroup = groups.at(-1)!;
    const finalEnd = Math.max(...finalGroup.noteIndexes.map((noteIndex) => (
      adjusted[noteIndex].localStart + adjusted[noteIndex].durationTicks
    )));
    const trailingGap = measureTicks - finalEnd;

    if (trailingGap > 0 && trailingGap <= unit) {
      for (const noteIndex of finalGroup.noteIndexes) {
        adjusted[noteIndex].durationTicks += trailingGap;
      }
    }
  }

  return adjusted.sort((left, right) => (
    left.localStart - right.localStart || left.pitch - right.pitch
  ));
}

function extractFeatures(
  candidateNotes: RankerNote[],
  messyNotes: RankerNote[],
  {
    measureTicks,
    ppq,
    timeSignature,
    tripletEvidence
  }: RankerOptions & {
    measureTicks: number;
    tripletEvidence: number;
  }
) {
  const events = collapseEvents(candidateNotes);
  const standardDurations = createStandardDurations(ppq);
  const tokenCount = createTokenCounter(standardDurations);
  const meter = createMeter(ppq, timeSignature);
  let currentEnd = 0;
  let durationTokenCount = 0;
  let restTokenCount = 0;
  let overlapCount = 0;
  let shortRestCount = 0;
  let readableTieSplitCount = 0;
  let releaseTrimOpportunityCount = 0;
  const durationValues = new Set<number>();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const nextStart = events[index + 1]?.start ?? measureTicks;

    if (event.start < currentEnd) {
      overlapCount += 1;
    }

    if (event.start > currentEnd) {
      const rest = event.start - currentEnd;
      restTokenCount += tokenCount(rest);
      shortRestCount += rest <= ppq / 4 ? 1 : 0;
    }

    durationTokenCount += tokenCount(event.duration);
    durationValues.add(event.duration);
    readableTieSplitCount += crossesReadableBoundary(
      event.start,
      event.duration,
      meter
    ) ? 1 : 0;
    releaseTrimOpportunityCount += findRestOverhangTrim(
      event.start,
      event.start + event.duration,
      nextStart,
      {
        measureTicks,
        ppq,
        standardDurations
      }
    ) ? 1 : 0;
    currentEnd = Math.max(currentEnd, event.start + event.duration);
  }

  if (currentEnd < measureTicks) {
    const trailingRest = measureTicks - currentEnd;
    restTokenCount += tokenCount(trailingRest);
    shortRestCount += trailingRest <= ppq / 4 ? 1 : 0;
  }

  const triplets = summarizeTripletRuns(events, ppq);
  const isolatedVeryShortEventCount = events.filter((event, index) => {
    if (event.duration >= ppq / 2) {
      return false;
    }

    const neighbors = [events[index - 1], events[index + 1]].filter(
      (neighbor): neighbor is RankerEvent => Boolean(neighbor)
    );
    return !neighbors.some((neighbor) => (
      neighbor.duration < ppq / 2 &&
      (
        neighbor.start + neighbor.duration === event.start ||
        event.start + event.duration === neighbor.start
      )
    ));
  }).length;

  return {
    completeTripletGroupCount: triplets.completeTripletGroupCount,
    durationTokenCount,
    durationVariety: durationValues.size,
    isolatedVeryShortEventCount,
    orphanTripletEventCount: triplets.orphanTripletEventCount,
    overlapCount,
    readableTieSplitCount,
    releaseTrimOpportunityCount,
    restTokenCount,
    shortRestCount,
    timingDistance: compareTracks(candidateNotes, messyNotes),
    tripletEvidence,
    usesTripletGrid: events.some((event) => (
      event.start % (ppq / 4) !== 0 ||
      event.duration % (ppq / 4) !== 0
    ))
  };
}

function scoreFeatures(features: ReturnType<typeof extractFeatures>) {
  let score = 0;
  score += features.timingDistance / (features.usesTripletGrid ? 31 : 26);
  score += features.durationTokenCount * 0.42;
  score += features.restTokenCount * 0.32;
  score += features.shortRestCount * 1.8;
  score += features.overlapCount * 4.5;
  score += features.releaseTrimOpportunityCount * 12;
  score += Math.max(0, features.durationVariety - 2) * 0.2;
  score -= features.completeTripletGroupCount * 2.75;
  score += features.orphanTripletEventCount * 1.25;
  score += features.isolatedVeryShortEventCount * 1.1;
  score += features.readableTieSplitCount * 0.15;

  if (features.usesTripletGrid && features.tripletEvidence < 8) {
    score += 1.5;
  }

  if (!features.usesTripletGrid && features.tripletEvidence > 24) {
    score += 1.25;
  }

  return score;
}

function createMeter(ppq: number, timeSignature: TimeSignature) {
  const simpleBeatTicks = ppq * (4 / timeSignature.denominator);
  const isCompound = (
    timeSignature.denominator === 8 &&
    timeSignature.numerator >= 6 &&
    timeSignature.numerator % 3 === 0
  );
  const beatTicks = isCompound ? simpleBeatTicks * 3 : simpleBeatTicks;
  const measureTicks = simpleBeatTicks * timeSignature.numerator;
  const beatBoundaries: number[] = [];

  for (let boundary = beatTicks; boundary < measureTicks; boundary += beatTicks) {
    beatBoundaries.push(boundary);
  }

  return {
    beatBoundaries,
    beatTicks,
    measureTicks,
    simpleBeatTicks
  };
}

function crossesReadableBoundary(
  start: number,
  duration: number,
  meter: ReturnType<typeof createMeter>
) {
  if (duration <= meter.simpleBeatTicks || isTripletDuration(duration, meter.simpleBeatTicks)) {
    return false;
  }

  if (start % meter.beatTicks === 0 && duration % meter.beatTicks === 0) {
    return false;
  }

  const end = start + duration;
  return meter.beatBoundaries.some((boundary) => start < boundary && end > boundary);
}

function isTripletDuration(duration: number, simpleBeatTicks: number) {
  return [
    simpleBeatTicks * 8 / 3,
    simpleBeatTicks * 4 / 3,
    simpleBeatTicks * 2 / 3,
    simpleBeatTicks / 3,
    simpleBeatTicks / 6,
    simpleBeatTicks / 12,
    simpleBeatTicks / 24
  ].some((value) => Math.round(value) === duration);
}

function summarizeTripletRuns(events: RankerEvent[], ppq: number) {
  let completeTripletGroupCount = 0;
  let orphanTripletEventCount = 0;
  let run: RankerEvent[] = [];

  function finishRun() {
    completeTripletGroupCount += Math.floor(run.length / 3);
    orphanTripletEventCount += run.length % 3;
    run = [];
  }

  for (const event of events) {
    const previous = run.at(-1);
    const triplet = isTripletDuration(event.duration, ppq);
    const continues = triplet && (
      !previous ||
      (
        previous.start + previous.duration === event.start &&
        previous.duration === event.duration
      )
    );

    if (!continues) {
      finishRun();
    }

    if (triplet) {
      run.push(event);
    }
  }

  finishRun();
  return { completeTripletGroupCount, orphanTripletEventCount };
}

function normalizeChordClusters(notes: RankerNote[], unit: number, ppq: number) {
  const clusters: Array<{ start: number; notes: RankerNote[] }> = [];

  for (const note of notes) {
    const cluster = clusters.find((candidate) => (
      note.localStart - candidate.start <= unit &&
      note.durationTicks >= ppq / 2 &&
      candidate.notes.every((candidateNote) => candidateNote.durationTicks >= ppq / 2)
    ));

    if (cluster) {
      cluster.notes.push(note);
    } else {
      clusters.push({ start: note.localStart, notes: [note] });
    }
  }

  for (const cluster of clusters) {
    if (cluster.notes.length < 2) {
      continue;
    }

    const start = mostCommonNumber(cluster.notes.map((note) => note.localStart));
    const end = mostCommonNumber(cluster.notes.map((note) => (
      note.localStart + note.durationTicks
    )));

    for (const note of cluster.notes) {
      note.localStart = start;
      note.durationTicks = Math.max(unit, end - start);
    }
  }
}

function trimRestOverhangs(
  notes: RankerNote[],
  groups: ReturnType<typeof groupEvents>,
  options: {
    measureTicks: number;
    ppq: number;
    standardDurations: number[];
    unit: number;
  }
) {
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const start = group.start;
    const end = Math.max(...group.noteIndexes.map((noteIndex) => (
      notes[noteIndex].localStart + notes[noteIndex].durationTicks
    )));
    const nextStart = groups[index + 1]?.start ?? options.measureTicks;
    const trim = findRestOverhangTrim(start, end, nextStart, options);

    if (!trim) {
      continue;
    }

    for (const noteIndex of group.noteIndexes) {
      notes[noteIndex].durationTicks = Math.max(
        options.unit,
        trim - notes[noteIndex].localStart
      );
    }
  }
}

function findRestOverhangTrim(
  start: number,
  end: number,
  nextStart: number,
  {
    measureTicks,
    ppq,
    standardDurations
  }: {
    measureTicks: number;
    ppq: number;
    standardDurations: number[];
  }
) {
  if (nextStart - end < ppq / 2) {
    return null;
  }

  for (let boundary = measureTicks; boundary > start; boundary -= ppq) {
    if (boundary >= end) {
      continue;
    }

    const overhang = end - boundary;

    if (overhang <= 0 || overhang > ppq / 2 || nextStart - boundary < ppq) {
      continue;
    }

    const tokenCount = createTokenCounter(standardDurations);

    if (tokenCount(boundary - start) < tokenCount(end - start)) {
      return boundary;
    }
  }

  return null;
}

function createStandardDurations(ppq: number) {
  return [
    ppq * 4,
    ppq * 3,
    ppq * 8 / 3,
    ppq * 2,
    ppq * 1.5,
    ppq * 4 / 3,
    ppq,
    ppq * 0.75,
    ppq * 2 / 3,
    ppq * 0.5,
    ppq * 0.375,
    ppq / 3,
    ppq * 0.25,
    ppq * 0.1875,
    ppq / 6,
    ppq * 0.125,
    ppq / 12,
    ppq / 16,
    ppq / 24
  ].map(Math.round).sort((left, right) => right - left);
}

function createTokenCounter(standardDurations: number[]) {
  const cache = new Map<number, number>([[0, 0]]);

  function count(duration: number): number {
    const ticks = Math.max(0, Math.round(duration));

    if (cache.has(ticks)) {
      return cache.get(ticks)!;
    }

    let best = Infinity;

    for (const standardDuration of standardDurations) {
      if (standardDuration <= ticks) {
        best = Math.min(best, 1 + count(ticks - standardDuration));
      }
    }

    cache.set(ticks, best);
    return Number.isFinite(best) ? best : 6;
  }

  return count;
}

function nearestStandardDuration(
  duration: number,
  unit: number,
  maximum: number,
  standardDurations: number[]
) {
  const compatible = standardDurations.filter((candidate) => (
    candidate <= maximum && candidate % unit === 0
  ));

  return compatible.reduce((best, candidate) => {
    const candidateDistance = Math.abs(candidate - duration);
    const bestDistance = Math.abs(best - duration);
    return candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && candidate > best)
      ? candidate
      : best;
  }, Math.min(maximum, unit));
}

function nextStandardDuration(
  duration: number,
  unit: number,
  maximum: number,
  standardDurations: number[]
) {
  const compatible = standardDurations
    .filter((candidate) => candidate <= maximum && candidate % unit === 0)
    .sort((left, right) => left - right);

  return compatible.find((candidate) => candidate >= duration) ??
    compatible.at(-1) ??
    Math.min(maximum, unit);
}

function groupEvents(notes: RankerNote[]) {
  const groups: Array<{ start: number; noteIndexes: number[] }> = [];

  notes.forEach((note, noteIndex) => {
    let group = groups.find((candidate) => candidate.start === note.localStart);

    if (!group) {
      group = { start: note.localStart, noteIndexes: [] };
      groups.push(group);
    }

    group.noteIndexes.push(noteIndex);
  });

  return groups.sort((left, right) => left.start - right.start);
}

function collapseEvents(notes: RankerNote[]) {
  const events: RankerEvent[] = [];

  for (const note of notes) {
    let event = events.find((candidate) => (
      candidate.start === note.localStart &&
      candidate.duration === note.durationTicks
    ));

    if (!event) {
      event = {
        start: note.localStart,
        duration: note.durationTicks,
        pitches: []
      };
      events.push(event);
    }

    event.pitches.push(note.pitch);
  }

  return events.sort((left, right) => left.start - right.start || right.duration - left.duration);
}

function compareTracks(leftNotes: RankerNote[], rightNotes: RankerNote[]) {
  const remaining = [...rightNotes];
  let total = Math.abs(leftNotes.length - rightNotes.length);

  for (const left of leftNotes) {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const right = remaining[index];

      if (right.pitch !== left.pitch) {
        continue;
      }

      const distance = Math.abs(left.localStart - right.localStart) +
        Math.abs(
          left.localStart + left.durationTicks -
          (right.localStart + right.durationTicks)
        );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      total += bestDistance;
      remaining.splice(bestIndex, 1);
    }
  }

  return total / Math.max(leftNotes.length, rightNotes.length, 1);
}

function gridFit(notes: RankerNote[], unit: number) {
  if (notes.length === 0) {
    return 0;
  }

  const total = notes.reduce((sum, note) => (
    sum +
    distanceToGrid(note.localStart, unit) +
    distanceToGrid(note.localStart + note.durationTicks, unit)
  ), 0);

  return total / (notes.length * 2);
}

function distanceToGrid(value: number, unit: number) {
  return Math.abs(value - roundToUnit(value, unit));
}

function isReconcilePolicy(policy: RankerPlan['policy']) {
  return policy === 'reconcile-jitter' ||
    policy === 'duration-snap-reconcile' ||
    policy === 'duration-ceil-reconcile';
}

function mostCommonNumber(values: number[]) {
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0][0];
}

function roundToUnit(value: number, unit: number) {
  return Math.round(value / unit) * unit;
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
