import type { TimeSignature } from './types.js';

export type RhythmConfidence = 'high' | 'medium' | 'low';
export type RhythmArticulation = 'staccato';

export type RhythmTemplate = {
  id: string;
  confidence: RhythmConfidence;
  meter: `${number}/${number}`;
  input: number[];
  spelling: number[][];
  beamAsOneGroup?: boolean;
  description: string;
};

export type RhythmCleanupRule = {
  id: string;
  confidence: RhythmConfidence;
  description: string;
};

export type RhythmBeamingRule = {
  id: string;
  confidence: RhythmConfidence;
  description: string;
};

export type RhythmGrammar = {
  templates: readonly RhythmTemplate[];
  cleanupRules: readonly RhythmCleanupRule[];
  beamingRules: readonly RhythmBeamingRule[];
};

export type RhythmMeter = {
  denominator: number;
  groupBoundaries: number[];
  groupRanges: Array<{ end: number; start: number }>;
  isCompound: boolean;
  measureTicks: number;
  numerator: number;
  pulseTicks: number;
  quarterTicks: number;
  simpleBeatTicks: number;
  spellingBeatTicks: number;
};

export type RhythmVoiceEvent = {
  start: number;
  duration: number;
  articulations?: Set<RhythmArticulation>;
  locksEnd?: boolean;
  performedDuration?: number;
};

const q = 1;
const e = 0.5;

export const rhythmGrammar: RhythmGrammar = {
  beamingRules: [
    {
      id: 'separate-complete-triplet-sets',
      confidence: 'high',
      description: 'Restart the beam for each complete three-note triplet set.'
    }
  ],
  templates: [
    {
      id: '2-4-half',
      confidence: 'high',
      meter: '2/4',
      input: [2],
      spelling: [[2]],
      description: 'Keep a measure-filling half note intact.'
    },
    {
      id: '2-4-two-quarters',
      confidence: 'high',
      meter: '2/4',
      input: [q, q],
      spelling: [[q], [q]],
      description: 'Keep one quarter note on each beat.'
    },
    {
      id: '2-4-dotted-quarter-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [1.5, e],
      spelling: [[1.5], [e]],
      description: 'Keep an aligned dotted quarter intact.'
    },
    {
      id: '2-4-eighth-dotted-quarter',
      confidence: 'high',
      meter: '2/4',
      input: [e, 1.5],
      spelling: [[e], [e, q]],
      description: 'Expose beat two in an offbeat dotted-quarter sustain.'
    },
    {
      id: '2-4-quarter-two-eighths',
      confidence: 'high',
      meter: '2/4',
      input: [q, e, e],
      spelling: [[q], [e], [e]],
      description: 'Keep the first beat whole and divide the second.'
    },
    {
      id: '2-4-two-eighths-quarter',
      confidence: 'high',
      meter: '2/4',
      input: [e, e, q],
      spelling: [[e], [e], [q]],
      description: 'Divide the first beat and keep the second whole.'
    },
    {
      id: '2-4-eighth-quarter-eighth',
      confidence: 'high',
      meter: '2/4',
      input: [e, q, e],
      spelling: [[e], [q], [e]],
      description: 'Keep the syncopated middle quarter intact.'
    },
    {
      id: '2-4-four-eighths',
      confidence: 'high',
      meter: '2/4',
      input: [e, e, e, e],
      spelling: [[e], [e], [e], [e]],
      description: 'Use four eighths with one beam group per beat.'
    },
    {
      id: '2-4-three-quarter-triplets',
      confidence: 'high',
      meter: '2/4',
      input: [2 / 3, 2 / 3, 2 / 3],
      spelling: [[2 / 3], [2 / 3], [2 / 3]],
      description: 'Preserve one complete two-beat quarter-note triplet.'
    },
    {
      id: '2-4-half-triplet-quarter-triplet',
      confidence: 'high',
      meter: '2/4',
      input: [4 / 3, 2 / 3],
      spelling: [[4 / 3], [2 / 3]],
      description: 'Preserve the two-unit then one-unit triplet pattern.'
    },
    {
      id: '2-4-quarter-triplet-half-triplet',
      confidence: 'high',
      meter: '2/4',
      input: [2 / 3, 4 / 3],
      spelling: [[2 / 3], [4 / 3]],
      description: 'Preserve the one-unit then two-unit triplet pattern.'
    },
    {
      id: '3-4-dotted-half',
      confidence: 'high',
      meter: '3/4',
      input: [3],
      spelling: [[3]],
      description: 'Keep a measure-filling dotted half intact.'
    },
    {
      id: '3-4-half-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [2, q],
      spelling: [[2], [q]],
      description: 'Keep an aligned half followed by a quarter intact.'
    },
    {
      id: '3-4-quarter-half',
      confidence: 'high',
      meter: '3/4',
      input: [q, 2],
      spelling: [[q], [2]],
      description: 'Keep an aligned quarter followed by a half intact.'
    },
    {
      id: '3-4-two-dotted-quarters',
      confidence: 'high',
      meter: '3/4',
      input: [1.5, 1.5],
      spelling: [[1.5], [e, q]],
      description: 'Split only the second dotted quarter at beat three.'
    },
    {
      id: '3-4-quarter-eighth-offbeat-dotted-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [q, e, 1.5],
      spelling: [[q], [e], [e, q]],
      description: 'Expose beat three in the final dotted quarter.'
    },
    {
      id: '3-4-eighth-quarter-offbeat-dotted-quarter',
      confidence: 'high',
      meter: '3/4',
      input: [e, q, 1.5],
      spelling: [[e], [e, e], [e, q]],
      description: 'Expose both crossed quarter-note beats.'
    },
    {
      id: '3-4-offbeat-half',
      confidence: 'high',
      meter: '3/4',
      input: [e, 2, e],
      spelling: [[e], [e, q, e], [e]],
      description: 'Show both beats crossed by an offbeat half note.'
    },
    {
      id: '4-4-long-offbeat-sustain',
      confidence: 'high',
      meter: '4/4',
      input: [e, 3, e],
      spelling: [[e], [e, 2, e], [e]],
      description: 'Use a half note between the two offbeat tie fragments.'
    },
    {
      id: '4-4-whole',
      confidence: 'high',
      meter: '4/4',
      input: [4],
      spelling: [[4]],
      description: 'Keep a measure-filling whole note intact.'
    },
    {
      id: '4-4-dotted-half-quarter',
      confidence: 'high',
      meter: '4/4',
      input: [3, q],
      spelling: [[3], [q]],
      description: 'Keep an aligned dotted half followed by a quarter intact.'
    },
    {
      id: '4-4-quarter-dotted-half',
      confidence: 'high',
      meter: '4/4',
      input: [q, 3],
      spelling: [[q], [3]],
      description: 'Keep an aligned quarter followed by a dotted half intact.'
    },
    {
      id: '4-4-quarter-half-quarter',
      confidence: 'high',
      meter: '4/4',
      input: [q, 2, q],
      spelling: [[q], [2], [q]],
      description: 'Keep a center-crossing aligned half note intact.'
    },
    {
      id: '3-8-dotted-quarter',
      confidence: 'high',
      meter: '3/8',
      input: [1.5],
      spelling: [[1.5]],
      description: 'Keep a pulse-filling dotted quarter intact.'
    },
    {
      id: '3-8-quarter-eighth',
      confidence: 'high',
      meter: '3/8',
      input: [q, e],
      spelling: [[q], [e]],
      description: 'Keep the quarter followed by an eighth intact.'
    },
    {
      id: '3-8-eighth-quarter',
      confidence: 'high',
      meter: '3/8',
      input: [e, q],
      spelling: [[e], [q]],
      description: 'Keep the eighth followed by a quarter intact.'
    },
    {
      id: '3-8-two-dotted-eighths',
      confidence: 'high',
      meter: '3/8',
      input: [0.75, 0.75],
      spelling: [[0.75], [0.75]],
      beamAsOneGroup: true,
      description: 'Keep both dotted eighths intact under one primary beam.'
    },
    {
      id: '3-8-three-eighths',
      confidence: 'high',
      meter: '3/8',
      input: [e, e, e],
      spelling: [[e], [e], [e]],
      beamAsOneGroup: true,
      description: 'Group the three eighth-note beats as one pulse.'
    }
  ],
  cleanupRules: [
    {
      id: 'trim-release-overhang',
      confidence: 'high',
      description: 'Trim a small tied release fragment when it reveals a clean following rest.'
    },
    {
      id: 'fill-sub-beat-release-gap',
      confidence: 'high',
      description: 'Absorb a sub-beat release rest into a clean duration.'
    },
    {
      id: 'staccato-on-double-extension',
      confidence: 'high',
      description: 'Add staccato when cleanup at least doubles the performed duration.'
    },
    {
      id: 'simplify-trailing-tuplet-rest',
      confidence: 'high',
      description: 'Normalize the two approved one-note trailing-rest triplet patterns.'
    },
    {
      id: 'simplify-trailing-three-eighth-rest',
      confidence: 'high',
      description: 'Fill an otherwise empty 3/8 pulse from its opening note.'
    },
    {
      id: 'consolidate-aligned-rests',
      confidence: 'high',
      description: 'Use the largest conventional rest that preserves required boundaries.'
    }
  ]
};

export function createRhythmMeter(
  divisions: number,
  timeSignature: TimeSignature
): RhythmMeter {
  const numerator = Math.max(1, Math.round(timeSignature.numerator));
  const denominator = Math.max(1, Math.round(timeSignature.denominator));
  const simpleBeatTicks = divisions * (4 / denominator);
  const measureTicks = Math.round(simpleBeatTicks * numerator);
  const groupCounts = meterGroupCounts(numerator, denominator);
  const groupRanges: RhythmMeter['groupRanges'] = [];
  let cursor = 0;

  for (const count of groupCounts) {
    const start = cursor;
    cursor = Math.min(measureTicks, cursor + Math.round(simpleBeatTicks * count));
    groupRanges.push({ start, end: cursor });
  }

  if (cursor < measureTicks) {
    groupRanges.push({ start: cursor, end: measureTicks });
  }

  const isCompound = denominator === 8 && numerator >= 6 && numerator % 3 === 0;
  const spellingBeatTicks = denominator === 2 ? divisions : simpleBeatTicks;

  return {
    denominator,
    groupBoundaries: groupRanges.slice(0, -1).map((group) => group.end),
    groupRanges,
    isCompound,
    measureTicks,
    numerator,
    pulseTicks: groupRanges[0]?.end ?? measureTicks,
    quarterTicks: divisions,
    simpleBeatTicks,
    spellingBeatTicks
  };
}

export function meterGroupCounts(numerator: number, denominator: number) {
  if (denominator === 2) {
    return numerator === 2
      ? [1, 1]
      : groupsOfFourThreeAndTwo(numerator);
  }

  if (denominator === 8 || denominator === 16) {
    if (numerator === 3) {
      return [3];
    }

    if (numerator === 6 || numerator === 9 || numerator === 12) {
      return repeatExact(3, numerator / 3);
    }

    if (numerator === 8) {
      return [3, 3, 2];
    }

    return groupsOfThreeAndTwo(numerator);
  }

  if (denominator === 4) {
    if (numerator === 2) {
      return [1, 1];
    }

    if (numerator === 3) {
      return [1, 1, 1];
    }

    if (numerator === 4) {
      return [2, 2];
    }

    return groupsOfFourThreeAndTwo(numerator);
  }

  return groupsOfFourThreeAndTwo(numerator);
}

export function applyRhythmGrammarToVoice<T extends RhythmVoiceEvent>(
  sourceEvents: T[],
  meter: RhythmMeter,
  isStandardDuration: (duration: number) => boolean
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
    candidate.input.every((duration, index) => approximatelyEqual(duration, durations[index]))
  ));

  if (!template) {
    return overrides;
  }

  events.forEach((event, index) => {
    overrides.set(
      event,
      template.spelling[index].map((duration) => Math.round(duration * meter.quarterTicks))
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
    isStandardDuration: (duration: number) => boolean;
    override?: number[];
  }
) {
  if (override && override.reduce((sum, chunk) => sum + chunk, 0) === duration) {
    return withStarts(start, override);
  }

  if (isTripletDuration(duration, meter.quarterTicks)) {
    return [{ start, duration }];
  }

  const end = start + duration;
  const crossesGroup = meter.groupBoundaries.some((boundary) => start < boundary && end > boundary);

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

  const boundaryUnit = meter.denominator === 8 || meter.denominator === 16
    ? null
    : meter.spellingBeatTicks;
  const mandatory = new Set<number>();

  if (boundaryUnit) {
    const next = Math.ceil((start + 1) / boundaryUnit) * boundaryUnit;
    const previous = Math.floor((end - 1) / boundaryUnit) * boundaryUnit;

    if (next > start && next < end) {
      mandatory.add(next);
    }

    if (previous > start && previous < end) {
      mandatory.add(previous);
    }
  } else {
    for (const boundary of meter.groupBoundaries) {
      if (start < boundary && end > boundary) {
        mandatory.add(boundary);
      }
    }
  }

  const boundaries = [start, ...[...mandatory].sort((left, right) => left - right), end];
  return boundaries.slice(0, -1).flatMap((segmentStart, index) => (
    withStarts(segmentStart, splitConventionalDuration(
      boundaries[index + 1] - segmentStart,
      meter.quarterTicks
    ))
  ));
}

export function rhythmGroupIndexAt(start: number, meter: RhythmMeter) {
  const index = meter.groupRanges.findIndex((group) => start >= group.start && start < group.end);
  return index >= 0 ? index : meter.groupRanges.length - 1;
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

function trimReleaseOverhangs<T extends RhythmVoiceEvent>(
  events: T[],
  meter: RhythmMeter,
  isStandardDuration: (duration: number) => boolean
) {
  const boundaries = spellingBoundaries(meter);

  events.forEach((event, index) => {
    if (event.locksEnd) {
      return;
    }

    const end = event.start + event.duration;

    if (isTripletDuration(event.duration, meter.quarterTicks)) {
      return;
    }

    const nextStart = events[index + 1]?.start ?? meter.measureTicks;
    const boundary = [...boundaries].reverse().find((candidate) => (
      candidate > event.start &&
      candidate < end &&
      end - candidate <= meter.spellingBeatTicks / 2 &&
      nextStart - candidate >= meter.spellingBeatTicks &&
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
  isStandardDuration: (duration: number) => boolean
) {
  const span = meter.spellingBeatTicks * 2;

  for (let start = 0; start + span <= meter.measureTicks; start += span) {
    const end = start + span;
    const inSpan = events.filter((event) => event.start >= start && event.start < end);

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
      (approximatelyEqual(event.duration, oneTripletUnit) ||
        approximatelyEqual(event.duration, oneTripletUnit * 2)) &&
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
  isStandardDuration: (duration: number) => boolean
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
  isStandardDuration: (duration: number) => boolean
) {
  if (meter.denominator !== 8 && meter.denominator !== 16) {
    return;
  }

  for (const group of meter.groupRanges) {
    if (!approximatelyEqual(group.end - group.start, meter.simpleBeatTicks * 3)) {
      continue;
    }

    const inGroup = events.filter((event) => event.start >= group.start && event.start < group.end);

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

function groupsOfFourThreeAndTwo(count: number) {
  if (count <= 0) {
    return [];
  }

  if (count <= 4) {
    return count === 1 ? [1] : [count];
  }

  const groups: number[] = [];
  let remaining = count;

  while (remaining > 0) {
    if (remaining === 5) {
      groups.push(3, 2);
      break;
    }

    if (remaining >= 4) {
      groups.push(4);
      remaining -= 4;
      continue;
    }

    groups.push(remaining);
    break;
  }

  return groups;
}

function groupsOfThreeAndTwo(count: number) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [1];
  }

  const groups: number[] = [];
  let remaining = count;

  while (remaining > 0) {
    if (remaining === 2 || remaining === 4) {
      groups.push(2);
      remaining -= 2;
      continue;
    }

    groups.push(3);
    remaining -= 3;
  }

  return groups;
}

function repeatExact(value: number, count: number) {
  return Array.from({ length: Math.max(0, Math.round(count)) }, () => value);
}

function withStarts(start: number, durations: number[]) {
  let cursor = start;

  return durations.map((duration) => {
    const chunk = { start: cursor, duration };
    cursor += duration;
    return chunk;
  });
}

function approximatelyEqual(left: number, right: number) {
  return Math.abs(left - right) <= 0.0001;
}
