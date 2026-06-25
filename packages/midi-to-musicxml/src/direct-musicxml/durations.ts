import { isTripletDuration } from '../rhythm/index.js';
import type { DurationNotation } from './types.js';

export const defaultDivisions = 960;

export const durationNotations: DurationNotation[] = [
  { duration: 5760, type: 'whole', dots: 1 },
  { duration: 3840, type: 'whole' },
  { duration: 2880, type: 'half', dots: 1 },
  { duration: 1920, type: 'half' },
  { duration: 1440, type: 'quarter', dots: 1 },
  {
    duration: 1280,
    type: 'half',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  },
  { duration: 960, type: 'quarter' },
  { duration: 720, type: 'eighth', dots: 1 },
  {
    duration: 640,
    type: 'quarter',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  },
  { duration: 480, type: 'eighth' },
  { duration: 360, type: '16th', dots: 1 },
  {
    duration: 320,
    type: 'eighth',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  },
  { duration: 240, type: '16th' },
  { duration: 180, type: '32nd', dots: 1 },
  {
    duration: 160,
    type: '16th',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  },
  { duration: 120, type: '32nd' },
  { duration: 90, type: '64th', dots: 1 },
  {
    duration: 80,
    type: '32nd',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  },
  { duration: 60, type: '64th' },
  {
    duration: 40,
    type: '64th',
    timeModification: { actualNotes: 3, normalNotes: 2 }
  }
];

export const durationByValue = new Map(
  durationNotations.map((notation) => [notation.duration, notation])
);

export function durationNotationFor(duration: number) {
  return durationByValue.get(duration) ?? durationNotations.at(-1)!;
}

export function appendDurationNotation(
  lines: string[],
  notation: DurationNotation
) {
  for (let index = 0; index < (notation.dots ?? 0); index += 1) {
    lines.push('        <dot/>');
  }

  if (notation.timeModification) {
    lines.push('        <time-modification>');
    lines.push(
      `          <actual-notes>${notation.timeModification.actualNotes}</actual-notes>`
    );
    lines.push(
      `          <normal-notes>${notation.timeModification.normalNotes}</normal-notes>`
    );
    lines.push('        </time-modification>');
  }
}

export function isSingleTripletDuration(duration: number) {
  return isTripletDuration(duration, defaultDivisions);
}

export function beamLevelForDuration(duration: number) {
  const type = durationByValue.get(duration)?.type;

  if (type === '64th') {
    return 4;
  }

  if (type === '32nd') {
    return 3;
  }

  if (type === '16th') {
    return 2;
  }

  return type === 'eighth' ? 1 : 0;
}

export function isBeamableDuration(duration: number) {
  const notation = durationByValue.get(duration);
  return Boolean(notation && isBeamableNotation(notation));
}

export function isBeamableNotation(notation: DurationNotation) {
  return notation.type === 'eighth' ||
    notation.type === '16th' ||
    notation.type === '32nd' ||
    notation.type === '64th';
}

export function isStandardDuration(duration: number) {
  return durationByValue.has(Math.round(duration));
}
