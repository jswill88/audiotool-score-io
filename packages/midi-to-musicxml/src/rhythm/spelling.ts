import { rhythmGrammar } from './rules.js';
import type {
  RhythmChunk,
  RhythmMeter,
  RhythmVoiceEvent,
  StandardDurationPredicate
} from './types.js';

export function createTemplateSpellingOverrides<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter
) {
  const overrides = new Map<T, number[]>();
  const meterName = `${meter.numerator}/${meter.denominator}`;
  const durations = events.map((event) => event.duration / meter.quarterTicks);
  let cursor = 0;
  const fillsMeasureWithoutRests = events.every((event) => {
    const contiguous = event.start === cursor;
    cursor = event.start + event.duration;
    return contiguous;
  }) && cursor === meter.measureTicks;

  if (!fillsMeasureWithoutRests) {
    return overrides;
  }

  const template = rhythmGrammar.templates.find((candidate) => (
    candidate.meter === meterName &&
    candidate.input.length === durations.length &&
    candidate.input.every((duration, index) => (
      approximatelyEqual(duration, durations[index])
    ))
  ));

  if (!template) {
    return overrides;
  }

  events.forEach((event, index) => {
    overrides.set(
      event,
      template.spelling[index].map((duration) => (
        Math.round(duration * meter.quarterTicks)
      ))
    );
  });
  return overrides;
}

export function spellRhythmDuration(
  start: number,
  duration: number,
  meter: RhythmMeter,
  {
    isStandardDuration,
    override
  }: {
    isStandardDuration: StandardDurationPredicate;
    override?: number[];
  }
): RhythmChunk[] {
  if (override && sum(override) === duration) {
    return withStarts(start, override);
  }

  if (isTripletDuration(duration, meter.quarterTicks)) {
    return [{ start, duration }];
  }

  const end = start + duration;
  const crossesGroup = meter.groupBoundaries.some((boundary) => (
    start < boundary && end > boundary
  ));

  if (
    isStandardDuration(duration) &&
    (
      (meter.denominator === 8 || meter.denominator === 16)
        ? !crossesGroup
        : start % meter.spellingBeatTicks === 0
    )
  ) {
    return [{ start, duration }];
  }

  if (
    isStandardDuration(duration) &&
    isGroupBoundary(start, meter) &&
    isGroupBoundary(end, meter)
  ) {
    return [{ start, duration }];
  }

  if (duration <= meter.spellingBeatTicks) {
    return [{ start, duration }];
  }

  const boundaries = durationBoundaries(start, end, meter);
  return boundaries.slice(0, -1).flatMap((segmentStart, index) => (
    withStarts(segmentStart, splitConventionalDuration(
      boundaries[index + 1] - segmentStart,
      meter.quarterTicks
    ))
  ));
}

export function isTripletDuration(duration: number, quarterTicks: number) {
  return [
    quarterTicks * 8 / 3,
    quarterTicks * 4 / 3,
    quarterTicks * 2 / 3,
    quarterTicks / 3,
    quarterTicks / 6,
    quarterTicks / 12,
    quarterTicks / 24
  ].some((value) => Math.round(value) === duration);
}

export function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.0001;
}

function durationBoundaries(start: number, end: number, meter: RhythmMeter) {
  const mandatory = new Set<number>();

  if (meter.denominator === 8 || meter.denominator === 16) {
    for (const boundary of meter.groupBoundaries) {
      if (start < boundary && end > boundary) {
        mandatory.add(boundary);
      }
    }
  } else {
    const next = Math.ceil((start + 1) / meter.spellingBeatTicks) *
      meter.spellingBeatTicks;
    const previous = Math.floor((end - 1) / meter.spellingBeatTicks) *
      meter.spellingBeatTicks;

    if (next > start && next < end) {
      mandatory.add(next);
    }

    if (previous > start && previous < end) {
      mandatory.add(previous);
    }
  }

  return [start, ...[...mandatory].sort((left, right) => left - right), end];
}

function isGroupBoundary(value: number, meter: RhythmMeter) {
  return value === 0 ||
    value === meter.measureTicks ||
    meter.groupBoundaries.includes(value);
}

function splitConventionalDuration(duration: number, quarterTicks: number) {
  const ratios = [
    6,
    4,
    3,
    2,
    1.5,
    1,
    0.75,
    0.5,
    0.375,
    0.25,
    0.1875,
    0.125,
    0.09375,
    0.0625
  ];
  const values = ratios.map((ratio) => Math.round(quarterTicks * ratio));
  const chunks: number[] = [];
  let remaining = Math.round(duration);

  while (remaining > 0) {
    const chunk = values.find((value) => value <= remaining) ?? remaining;
    chunks.push(chunk);
    remaining -= chunk;
  }

  return chunks;
}

function withStarts(start: number, durations: number[]): RhythmChunk[] {
  let cursor = start;

  return durations.map((duration) => {
    const chunk = { start: cursor, duration };
    cursor += duration;
    return chunk;
  });
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}
