import { rhythmGrammar } from './rules.js';
import type {
  RhythmChunk,
  RhythmMeter,
  RhythmTemplate,
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

  if (fillsMeasureWithoutRests) {
    const template = rhythmGrammar.templates.find((candidate) => (
      candidate.meter === meterName &&
      candidate.input.length === durations.length &&
      candidate.input.every((duration, index) => (
        approximatelyEqual(duration, durations[index])
      ))
    ));

    if (template) {
      events.forEach((event, index) => {
        overrides.set(
          event,
          template.spelling[index].map((duration) => (
            Math.round(duration * meter.quarterTicks)
          ))
        );
      });
    }
  }

  applyGroupTemplateOverrides(events, meter, overrides);
  return overrides;
}

export function spellRhythmDuration(
  start: number,
  duration: number,
  meter: RhythmMeter,
  {
    isStandardDuration,
    override,
    splitShortBeatOverlaps = false
  }: {
    isStandardDuration: StandardDurationPredicate;
    override?: number[];
    splitShortBeatOverlaps?: boolean;
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

  if (
    isStandardDuration(duration) &&
    duration <= meter.spellingBeatTicks &&
    !(
      splitShortBeatOverlaps &&
      duration < meter.spellingBeatTicks &&
      crossesSpellingBeatBoundary(start, end, meter)
    )
  ) {
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

function crossesSpellingBeatBoundary(
  start: number,
  end: number,
  meter: RhythmMeter
) {
  if (meter.denominator === 8 || meter.denominator === 16) {
    return false;
  }

  const next = Math.ceil((start + 1) / meter.spellingBeatTicks) *
    meter.spellingBeatTicks;
  return next > start && next < end && next < meter.measureTicks;
}

function applyGroupTemplateOverrides<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  overrides: Map<T, number[]>
) {
  const templates = rhythmGrammar.templates.filter((template) => (
    template.match === 'measure-or-group' &&
    templateDenominator(template) === meter.denominator
  ));

  for (const template of templates) {
    const span = templateSpanTicks(template, meter);
    const ranges = [
      ...(span === meter.measureTicks ? [{ start: 0, end: meter.measureTicks }] : []),
      ...meter.groupRanges.filter((range) => range.end - range.start === span)
    ];

    for (const range of ranges) {
      const window = contiguousEventsInRange(events, range);

      if (!window || !matchesTemplate(window, template, meter)) {
        continue;
      }

      window.forEach((event, index) => {
        overrides.set(
          event,
          template.spelling[index].map((duration) => (
            Math.round(duration * meter.quarterTicks)
          ))
        );
      });
    }
  }
}

function contiguousEventsInRange<T extends RhythmVoiceEvent>(
  events: T[],
  range: { end: number; start: number }
) {
  const startIndex = events.findIndex((event) => event.start === range.start);

  if (startIndex < 0) {
    return null;
  }

  const window: T[] = [];
  let cursor = range.start;

  for (let index = startIndex; index < events.length && cursor < range.end; index += 1) {
    const event = events[index];

    if (event.start !== cursor || event.start + event.duration > range.end) {
      return null;
    }

    window.push(event);
    cursor = event.start + event.duration;
  }

  return cursor === range.end ? window : null;
}

function matchesTemplate(
  events: RhythmVoiceEvent[],
  template: RhythmTemplate,
  meter: RhythmMeter
) {
  return template.input.length === events.length &&
    template.input.every((duration, index) => (
      approximatelyEqual(duration, events[index].duration / meter.quarterTicks)
    ));
}

function templateSpanTicks(template: RhythmTemplate, meter: RhythmMeter) {
  return Math.round(sum(template.input) * meter.quarterTicks);
}

function templateDenominator(template: RhythmTemplate) {
  return Number(template.meter.split('/')[1]);
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
