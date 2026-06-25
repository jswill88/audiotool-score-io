export function mostCommonNumber(values: number[]) {
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0] - right[0])[0][0];
}

export function roundToUnit(value: number, unit: number) {
  return Math.round(value / unit) * unit;
}

export function distanceToGrid(value: number, unit: number) {
  return Math.abs(value - roundToUnit(value, unit));
}

export function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}
