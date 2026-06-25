import {
  approximatelyEqual,
  isTripletDuration
} from './spelling.js';
import type {
  RhythmMeter,
  RhythmVoiceEvent,
  StandardDurationPredicate
} from './types.js';

export function applyRhythmGrammarToVoice<T extends RhythmVoiceEvent>(
  sourceEvents: T[],
  meter: RhythmMeter,
  isStandardDuration: StandardDurationPredicate
): T[] {
  const events = sourceEvents.map((event) => ({
    ...event,
    articulations: new Set(event.articulations ?? []),
    performedDuration: event.performedDuration ?? event.duration
  }));

  trimReleaseOverhangs(events, meter, isStandardDuration);
  simplifyTrailingTupletRests(events, meter, isStandardDuration);
  fillSubBeatReleaseGaps(events, meter, isStandardDuration);
  simplifyTrailingThreeEighthRests(events, meter, isStandardDuration);

  return events;
}

function trimReleaseOverhangs<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  isStandardDuration: StandardDurationPredicate
) {
  const boundaries = spellingBoundaries(meter);

  events.forEach((event, index) => {
    if (
      event.locksEnd ||
      isTripletDuration(event.duration, meter.quarterTicks)
    ) {
      return;
    }

    const end = event.start + event.duration;
    const nextStart = events[index + 1]?.start ?? meter.measureTicks;
    const boundary = [...boundaries].reverse().find((candidate) => (
      candidate > event.start &&
      candidate < end &&
      end - candidate <= meter.spellingBeatTicks / 2 &&
      nextStart > end &&
      isStandardDuration(nextStart - candidate) &&
      isStandardDuration(candidate - event.start)
    ));

    if (boundary !== undefined) {
      event.duration = boundary - event.start;
    }
  });
}

function simplifyTrailingTupletRests<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  isStandardDuration: StandardDurationPredicate
) {
  const span = meter.spellingBeatTicks * 2;

  for (let start = 0; start + span <= meter.measureTicks; start += span) {
    const end = start + span;
    const inSpan = events.filter((event) => (
      event.start >= start && event.start < end
    ));

    if (
      inSpan.length !== 1 ||
      inSpan[0].start !== start ||
      inSpan[0].locksEnd
    ) {
      continue;
    }

    const event = inSpan[0];
    const oneTripletUnit = Math.round(span / 3);

    if (
      (
        approximatelyEqual(event.duration, oneTripletUnit) ||
        approximatelyEqual(event.duration, oneTripletUnit * 2)
      ) &&
      isStandardDuration(span / 2)
    ) {
      event.duration = span / 2;
      addExtensionArticulation(event);
    }
  }
}

function fillSubBeatReleaseGaps<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  isStandardDuration: StandardDurationPredicate
) {
  events.forEach((event, index) => {
    if (
      event.locksEnd ||
      event.duration >= meter.spellingBeatTicks ||
      isTripletDuration(event.duration, meter.quarterTicks)
    ) {
      return;
    }

    const beatEnd = Math.ceil((event.start + 1) / meter.spellingBeatTicks) *
      meter.spellingBeatTicks;
    const nextStart = events[index + 1]?.start ?? meter.measureTicks;
    const targetEnd = Math.min(beatEnd, nextStart);
    const targetDuration = targetEnd - event.start;

    if (
      targetEnd > event.start + event.duration &&
      targetEnd <= nextStart &&
      isStandardDuration(targetDuration)
    ) {
      event.duration = targetDuration;
      addExtensionArticulation(event);
    }
  });
}

function simplifyTrailingThreeEighthRests<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  isStandardDuration: StandardDurationPredicate
) {
  if (meter.denominator !== 8 && meter.denominator !== 16) {
    return;
  }

  for (const group of meter.groupRanges) {
    if (!approximatelyEqual(group.end - group.start, meter.simpleBeatTicks * 3)) {
      continue;
    }

    const inGroup = events.filter((event) => (
      event.start >= group.start && event.start < group.end
    ));

    if (
      inGroup.length !== 1 ||
      inGroup[0].start !== group.start ||
      inGroup[0].locksEnd ||
      inGroup[0].duration >= group.end - group.start ||
      isTripletDuration(inGroup[0].duration, meter.quarterTicks) ||
      !isStandardDuration(group.end - group.start)
    ) {
      continue;
    }

    inGroup[0].duration = group.end - group.start;
    addExtensionArticulation(inGroup[0]);
  }
}

function addExtensionArticulation(event: RhythmVoiceEvent) {
  if (
    event.performedDuration &&
    event.duration >= event.performedDuration * 2
  ) {
    event.articulations ??= new Set();
    event.articulations.add('staccato');
  }
}

function spellingBoundaries(meter: RhythmMeter) {
  if (meter.denominator === 8 || meter.denominator === 16) {
    return meter.groupBoundaries;
  }

  const boundaries: number[] = [];

  for (
    let boundary = meter.spellingBeatTicks;
    boundary < meter.measureTicks;
    boundary += meter.spellingBeatTicks
  ) {
    boundaries.push(boundary);
  }

  return boundaries;
}
