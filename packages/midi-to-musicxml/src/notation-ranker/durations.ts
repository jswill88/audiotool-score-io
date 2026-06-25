export function createStandardDurations(ppq: number) {
  return [
    ppq * 4,
    ppq * 3,
    ppq * 8 / 3,
    ppq * 2,
    ppq * 1.5,
    ppq * 4 / 3,
    ppq,
    ppq * 0.75,
    ppq * 2 / 3,
    ppq * 0.5,
    ppq * 0.375,
    ppq / 3,
    ppq * 0.25,
    ppq * 0.1875,
    ppq / 6,
    ppq * 0.125,
    ppq / 12,
    ppq / 16,
    ppq / 24
  ].map(Math.round).sort((left, right) => right - left);
}

export function createTokenCounter(standardDurations: number[]) {
  const cache = new Map<number, number>([[0, 0]]);

  function count(duration: number): number {
    const ticks = Math.max(0, Math.round(duration));

    if (cache.has(ticks)) {
      return cache.get(ticks)!;
    }

    let best = Infinity;

    for (const standardDuration of standardDurations) {
      if (standardDuration <= ticks) {
        best = Math.min(best, 1 + count(ticks - standardDuration));
      }
    }

    cache.set(ticks, best);
    return Number.isFinite(best) ? best : 6;
  }

  return count;
}

export function nearestStandardDuration(
  duration: number,
  unit: number,
  maximum: number,
  standardDurations: number[]
) {
  const compatible = standardDurations.filter((candidate) => (
    candidate <= maximum && candidate % unit === 0
  ));

  return compatible.reduce((best, candidate) => {
    const candidateDistance = Math.abs(candidate - duration);
    const bestDistance = Math.abs(best - duration);
    return candidateDistance < bestDistance ||
      (candidateDistance === bestDistance && candidate > best)
      ? candidate
      : best;
  }, Math.min(maximum, unit));
}

export function nextStandardDuration(
  duration: number,
  unit: number,
  maximum: number,
  standardDurations: number[]
) {
  const compatible = standardDurations
    .filter((candidate) => candidate <= maximum && candidate % unit === 0)
    .sort((left, right) => left - right);

  return compatible.find((candidate) => candidate >= duration) ??
    compatible.at(-1) ??
    Math.min(maximum, unit);
}

export function isTripletDuration(duration: number, simpleBeatTicks: number) {
  return [
    simpleBeatTicks * 8 / 3,
    simpleBeatTicks * 4 / 3,
    simpleBeatTicks * 2 / 3,
    simpleBeatTicks / 3,
    simpleBeatTicks / 6,
    simpleBeatTicks / 12,
    simpleBeatTicks / 24
  ].some((value) => Math.round(value) === duration);
}
