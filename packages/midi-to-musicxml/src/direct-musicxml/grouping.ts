import {
  rhythmGroupIndexAt,
  spellRhythmDuration
} from '../rhythm/index.js';
import type { RhythmMeter } from '../rhythm/index.js';
import {
  beamLevelForDuration,
  isBeamableDuration,
  isSingleTripletDuration,
  isStandardDuration
} from './durations.js';
import type {
  BeamLookup,
  BeamMode,
  TupletMode,
  VoiceChunk,
  VoiceEvent
} from './types.js';

export function createBeamLookup(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const lookup: BeamLookup = new Map();
  const allChunks = createVoiceChunks(
    events,
    measureDuration,
    meter,
    spellingOverrides
  );
  const chunks = allChunks.filter((chunk) => (
    isBeamableDuration(chunk.duration) &&
    (
      chunk.kind === 'note' ||
      meter.denominator === 8 ||
      meter.denominator === 16
    )
  ));
  const maximumLevel = Math.max(
    0,
    ...chunks.map((chunk) => beamLevelForDuration(chunk.duration))
  );

  for (let level = 1; level <= maximumLevel; level += 1) {
    let run: VoiceChunk[] = [];

    function finishRun() {
      if (run.length > 1) {
        run.forEach((chunk, index) => {
          setBeamMode(
            lookup,
            chunk,
            level,
            index === 0
              ? 'begin'
              : index === run.length - 1
                ? 'end'
                : 'continue'
          );
        });
      } else if (run.length === 1 && level > 1) {
        const chunk = run[0];
        const neighboringPrimaryBeam = lookup
          .get(eventKey(chunk.start, chunk.duration))
          ?.has(1);

        if (neighboringPrimaryBeam) {
          setBeamMode(lookup, chunk, level, 'forward hook');
        }
      }

      run = [];
    }

    for (const chunk of chunks) {
      const previous = run.at(-1);
      const participates = beamLevelForDuration(chunk.duration) >= level;
      const continues = participates && (
        !previous ||
        (
          previous.start + previous.duration === chunk.start &&
          rhythmGroupIndexAt(previous.start, meter) ===
            rhythmGroupIndexAt(chunk.start, meter) &&
          belongsToSameTripletBeamSet(previous, chunk) &&
          canContinuePrimaryBeam(previous, chunk, meter, allChunks, level) &&
          (
            level === 1 ||
            Math.floor(previous.start / meter.simpleBeatTicks) ===
              Math.floor(chunk.start / meter.simpleBeatTicks)
          )
        )
      );

      if (!continues) {
        finishRun();
      }

      if (participates) {
        run.push(chunk);
      }
    }

    finishRun();
  }

  return lookup;
}

function canContinuePrimaryBeam(
  previous: VoiceChunk,
  current: VoiceChunk,
  meter: RhythmMeter,
  allChunks: VoiceChunk[],
  level: number
) {
  if (level !== 1 || meter.denominator !== 4) {
    return true;
  }

  const boundary = current.start;

  if (
    boundary <= 0 ||
    boundary >= meter.measureTicks ||
    boundary % meter.simpleBeatTicks !== 0
  ) {
    return true;
  }

  const group = meter.groupRanges.find((range) => (
    boundary > range.start && boundary < range.end
  ));

  if (!group || group.end - group.start <= meter.simpleBeatTicks) {
    return true;
  }

  const groupChunks = allChunks.filter((chunk) => (
    chunk.start >= group.start &&
    chunk.start + chunk.duration <= group.end
  ));
  const eighthTicks = Math.round(meter.quarterTicks / 2);

  return groupChunks.length > 0 && groupChunks.every((chunk) => (
    chunk.kind === 'note' && chunk.duration === eighthTicks
  ));
}

function belongsToSameTripletBeamSet(
  previous: { duration: number; start: number },
  current: { duration: number; start: number }
) {
  const previousIsTriplet = isSingleTripletDuration(previous.duration);
  const currentIsTriplet = isSingleTripletDuration(current.duration);

  if (!previousIsTriplet && !currentIsTriplet) {
    return true;
  }

  if (
    !previousIsTriplet ||
    !currentIsTriplet ||
    previous.duration !== current.duration
  ) {
    return false;
  }

  const tripletSetDuration = current.duration * 3;
  return Math.floor(previous.start / tripletSetDuration) ===
    Math.floor(current.start / tripletSetDuration);
}

export function createTupletLookup(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const lookup = new Map<string, TupletMode[]>();
  const chunks = createVoiceChunks(
    events,
    measureDuration,
    meter,
    spellingOverrides
  );
  let run: VoiceChunk[] = [];

  function addMode(chunk: VoiceChunk, mode: TupletMode) {
    const key = eventKey(chunk.start, chunk.duration);
    lookup.set(key, [...(lookup.get(key) ?? []), mode]);
  }

  function finishRun() {
    let startIndex = 0;

    while (startIndex < run.length) {
      let total = 0;
      let minimum = Infinity;
      let matchedEnd = -1;

      for (
        let endIndex = startIndex;
        endIndex < run.length;
        endIndex += 1
      ) {
        total += run[endIndex].duration;
        minimum = Math.min(minimum, run[endIndex].duration);

        if (total === minimum * 3) {
          matchedEnd = endIndex;
          break;
        }

        if (total > minimum * 3) {
          break;
        }
      }

      if (matchedEnd < 0) {
        break;
      }

      addMode(run[startIndex], 'start');
      addMode(run[matchedEnd], 'stop');
      startIndex = matchedEnd + 1;
    }

    run = [];
  }

  for (const chunk of chunks) {
    const previous = run.at(-1);
    const continues = isSingleTripletDuration(chunk.duration) && (
      !previous ||
      previous.start + previous.duration === chunk.start
    );

    if (!continues) {
      finishRun();
    }

    if (isSingleTripletDuration(chunk.duration)) {
      run.push(chunk);
    }
  }

  finishRun();
  return lookup;
}

function createVoiceChunks(
  events: VoiceEvent[],
  measureDuration: number,
  meter: RhythmMeter,
  spellingOverrides: Map<VoiceEvent, number[]>
) {
  const chunks: VoiceChunk[] = [];
  let cursor = 0;

  for (const event of events) {
    if (event.start > cursor) {
      chunks.push(...spellRhythmDuration(
        cursor,
        event.start - cursor,
        meter,
        { isStandardDuration }
      ).map((chunk) => ({ ...chunk, kind: 'rest' as const })));
    }

    chunks.push(...spellRhythmDuration(
      event.start,
      event.duration,
      meter,
      {
        isStandardDuration,
        override: spellingOverrides.get(event)
      }
    ).map((chunk) => ({ ...chunk, kind: 'note' as const })));
    cursor = event.start + event.duration;
  }

  if (cursor < measureDuration) {
    chunks.push(...spellRhythmDuration(
      cursor,
      measureDuration - cursor,
      meter,
      { isStandardDuration }
    ).map((chunk) => ({ ...chunk, kind: 'rest' as const })));
  }

  return chunks;
}

function setBeamMode(
  lookup: BeamLookup,
  chunk: { duration: number; start: number },
  level: number,
  mode: BeamMode
) {
  const key = eventKey(chunk.start, chunk.duration);
  const levels = lookup.get(key) ?? new Map<number, BeamMode>();
  levels.set(level, mode);
  lookup.set(key, levels);
}

export function eventKey(start: number, duration: number) {
  return `${start}:${duration}`;
}
