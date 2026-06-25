import type { TimeSignature } from '../types.js';
import type { RhythmMeter } from './types.js';

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

  return {
    denominator,
    groupBoundaries: groupRanges.slice(0, -1).map((group) => group.end),
    groupRanges,
    isCompound: denominator === 8 && numerator >= 6 && numerator % 3 === 0,
    measureTicks,
    numerator,
    pulseTicks: groupRanges[0]?.end ?? measureTicks,
    quarterTicks: divisions,
    simpleBeatTicks,
    spellingBeatTicks: denominator === 2 ? divisions : simpleBeatTicks
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
  }

  return groupsOfFourThreeAndTwo(numerator);
}

export function rhythmGroupIndexAt(start: number, meter: RhythmMeter) {
  const index = meter.groupRanges.findIndex((group) => (
    start >= group.start && start < group.end
  ));
  return index >= 0 ? index : meter.groupRanges.length - 1;
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
