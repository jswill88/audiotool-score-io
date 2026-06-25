import {
  createStandardDurations,
  createTokenCounter,
  isTripletDuration
} from './durations.js';
import {
  collapseEvents,
  compareTracks
} from './events.js';
import type {
  RankerEvent,
  RankerFeatures,
  RankerNote,
  RankerOptions
} from './types.js';

export function extractFeatures(
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
): RankerFeatures {
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
  const durationValues = new Set<number>();

  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];

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

export function scoreFeatures(features: RankerFeatures) {
  let score = 0;
  score += features.timingDistance / (features.usesTripletGrid ? 31 : 26);
  score += features.durationTokenCount * 0.42;
  score += features.restTokenCount * 0.32;
  score += features.shortRestCount * 1.8;
  score += features.overlapCount * 4.5;
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

function createMeter(
  ppq: number,
  timeSignature: RankerOptions['timeSignature']
) {
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
  if (
    duration <= meter.simpleBeatTicks ||
    isTripletDuration(duration, meter.simpleBeatTicks)
  ) {
    return false;
  }

  if (start % meter.beatTicks === 0 && duration % meter.beatTicks === 0) {
    return false;
  }

  const end = start + duration;
  return meter.beatBoundaries.some((boundary) => (
    start < boundary && end > boundary
  ));
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
