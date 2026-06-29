import type {
  Clef,
  OctaveShiftRange,
  OctaveShiftType,
  VoiceEvent
} from './types.js';
import { clefSpecFor } from './clefs.js';

const runShiftOctavesOutsideStaff = 1;
const isolatedShiftOctavesOutsideStaff = 2;
const semitonesPerOctave = 12;

export function createOctaveShiftRanges(
  events: VoiceEvent[],
  clef: Clef
): OctaveShiftRange[] {
  const ranges: OctaveShiftRange[] = [];
  let current:
    | (OctaveShiftRange & {
        eventCount: number;
        shiftsWhenIsolated: boolean;
      })
    | null = null;

  function finishRange() {
    if (
      current &&
      (current.eventCount >= 2 || current.shiftsWhenIsolated)
    ) {
      const {
        eventCount: _eventCount,
        shiftsWhenIsolated: _shiftsWhenIsolated,
        ...range
      } = current;
      ranges.push(range);
    }

    current = null;
  }

  for (const event of events) {
    const type = octaveShiftTypeForPitches(
      event.pitches,
      clef,
      runShiftOctavesOutsideStaff
    );
    const isolatedType = octaveShiftTypeForPitches(
      event.pitches,
      clef,
      isolatedShiftOctavesOutsideStaff
    );
    const shiftsWhenIsolated = type !== null && type === isolatedType;
    const end = event.start + event.duration;

    if (!type) {
      finishRange();
      continue;
    }

    if (current && current.type === type && current.end === event.start) {
      current.end = end;
      current.eventCount += 1;
      current.shiftsWhenIsolated ||= shiftsWhenIsolated;
      continue;
    }

    finishRange();
    current = {
      end,
      eventCount: 1,
      shiftsWhenIsolated,
      start: event.start,
      type
    };
  }

  finishRange();
  return ranges;
}

function octaveShiftTypeForPitches(
  pitches: number[],
  clef: Clef,
  octavesOutsideStaff: number
): OctaveShiftType | null {
  if (pitches.length === 0) {
    return null;
  }

  const range = clefSpecFor(clef).staffRange;
  const thresholdOffset = octavesOutsideStaff * semitonesPerOctave;
  const highThreshold = range.top + thresholdOffset;
  const lowThreshold = range.bottom - thresholdOffset;

  if (pitches.every((pitch) => pitch > highThreshold)) {
    return 'down';
  }

  if (pitches.every((pitch) => pitch < lowThreshold)) {
    return 'up';
  }

  return null;
}
