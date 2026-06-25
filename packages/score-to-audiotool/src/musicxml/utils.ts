import path from 'path';
import { audiotoolTicksPerBeat } from './constants.js';
import type { TimeSignature } from './types.js';

export function uniqueChanges<T>(
  values: T[],
  key: (value: T) => string
) {
  const seen = new Set<string>();
  return [...values]
    .sort((left, right) => (
      Number((left as { sourceTicks?: number }).sourceTicks ?? 0) -
      Number((right as { sourceTicks?: number }).sourceTicks ?? 0)
    ))
    .filter((value) => {
      const valueKey = key(value);

      if (seen.has(valueKey)) {
        return false;
      }

      seen.add(valueKey);
      return true;
    });
}

export function quartersToTicks(quarters: number) {
  return Math.max(0, Math.round(quarters * audiotoolTicksPerBeat));
}

export function roundDurationToMeasure(
  durationTicks: number,
  timeSignature: TimeSignature
) {
  const beatTicks = audiotoolTicksPerBeat * (
    4 / timeSignature.denominator
  );
  const measureTicks = Math.max(
    1,
    Math.round(beatTicks * timeSignature.numerator)
  );

  return Math.max(
    measureTicks,
    Math.ceil(Math.max(1, durationTicks) / measureTicks) * measureTicks
  );
}

export function cleanTitle(value: unknown) {
  const title = String(value ?? '').replace(/\s+/g, ' ').trim();
  return title.slice(0, 120);
}

export function titleFromSourceName(sourceName: string | undefined) {
  const base = path.parse(sourceName || 'Imported Score').name
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base || 'Imported Score';
}

export function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback = min
) {
  const number = Math.round(Number(value));
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number
) {
  const number = Number(value);
  return Number.isFinite(number)
    ? Math.min(max, Math.max(min, number))
    : fallback;
}

export function roundDecimal(value: number, places: number) {
  const scale = 10 ** places;
  return Math.round(value * scale) / scale;
}
