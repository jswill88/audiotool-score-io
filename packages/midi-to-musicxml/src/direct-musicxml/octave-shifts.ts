import type {
  Clef,
  OctaveShiftRange,
  OctaveShiftType,
  VoiceEvent
} from './types.js';

const staffRanges: Record<Clef, { bottom: number; top: number }> = {
  treble: { bottom: 64, top: 77 },
  bass: { bottom: 43, top: 57 }
};

export function createOctaveShiftRanges(
  events: VoiceEvent[],
  clef: Clef
): OctaveShiftRange[] {
  const ranges: OctaveShiftRange[] = [];
  let current: (OctaveShiftRange & { eventCount: number }) | null = null;

  function finishRange() {
    if (current && current.eventCount >= 2) {
      const { eventCount: _eventCount, ...range } = current;
      ranges.push(range);
    }

    current = null;
  }

  for (const event of events) {
    const type = octaveShiftTypeForPitches(event.pitches, clef);
    const end = event.start + event.duration;

    if (!type) {
      finishRange();
      continue;
    }

    if (current && current.type === type && current.end === event.start) {
      current.end = end;
      current.eventCount += 1;
      continue;
    }

    finishRange();
    current = {
      end,
      eventCount: 1,
      start: event.start,
      type
    };
  }

  finishRange();
  return ranges;
}

function octaveShiftTypeForPitches(
  pitches: number[],
  clef: Clef
): OctaveShiftType | null {
  if (pitches.length === 0) {
    return null;
  }

  const range = staffRanges[clef];
  const highThreshold = range.top + 12;
  const lowThreshold = range.bottom - 12;

  if (pitches.every((pitch) => pitch > highThreshold)) {
    return 'down';
  }

  if (pitches.every((pitch) => pitch < lowThreshold)) {
    return 'up';
  }

  return null;
}
