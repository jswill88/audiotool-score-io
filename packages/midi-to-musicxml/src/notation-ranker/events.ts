import { distanceToGrid, mostCommonNumber } from './math.js';
import type {
  RankerEvent,
  RankerEventGroup,
  RankerNote
} from './types.js';

export function groupEvents(notes: RankerNote[]): RankerEventGroup[] {
  const groups: RankerEventGroup[] = [];

  notes.forEach((note, noteIndex) => {
    let group = groups.find((candidate) => candidate.start === note.localStart);

    if (!group) {
      group = { start: note.localStart, noteIndexes: [] };
      groups.push(group);
    }

    group.noteIndexes.push(noteIndex);
  });

  return groups.sort((left, right) => left.start - right.start);
}

export function collapseEvents(notes: RankerNote[]) {
  const events: RankerEvent[] = [];

  for (const note of notes) {
    let event = events.find((candidate) => (
      candidate.start === note.localStart &&
      candidate.duration === note.durationTicks
    ));

    if (!event) {
      event = {
        start: note.localStart,
        duration: note.durationTicks
      };
      events.push(event);
    }
  }

  return events.sort((left, right) => (
    left.start - right.start || right.duration - left.duration
  ));
}

export function normalizeChordClusters(
  notes: RankerNote[],
  unit: number,
  ppq: number
) {
  const clusters: Array<{ start: number; notes: RankerNote[] }> = [];

  for (const note of notes) {
    const cluster = clusters.find((candidate) => (
      note.localStart - candidate.start <= unit &&
      note.durationTicks >= ppq / 2 &&
      candidate.notes.every((candidateNote) => candidateNote.durationTicks >= ppq / 2)
    ));

    if (cluster) {
      cluster.notes.push(note);
    } else {
      clusters.push({ start: note.localStart, notes: [note] });
    }
  }

  for (const cluster of clusters) {
    if (cluster.notes.length < 2) {
      continue;
    }

    const start = mostCommonNumber(cluster.notes.map((note) => note.localStart));
    const end = mostCommonNumber(cluster.notes.map((note) => (
      note.localStart + note.durationTicks
    )));

    for (const note of cluster.notes) {
      note.localStart = start;
      note.durationTicks = Math.max(unit, end - start);
    }
  }
}

export function compareTracks(
  leftNotes: RankerNote[],
  rightNotes: RankerNote[]
) {
  const remaining = [...rightNotes];
  let total = Math.abs(leftNotes.length - rightNotes.length);

  for (const left of leftNotes) {
    let bestIndex = -1;
    let bestDistance = Infinity;

    for (let index = 0; index < remaining.length; index += 1) {
      const right = remaining[index];

      if (right.pitch !== left.pitch) {
        continue;
      }

      const distance = Math.abs(left.localStart - right.localStart) +
        Math.abs(
          left.localStart + left.durationTicks -
          (right.localStart + right.durationTicks)
        );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    }

    if (bestIndex >= 0) {
      total += bestDistance;
      remaining.splice(bestIndex, 1);
    }
  }

  return total / Math.max(leftNotes.length, rightNotes.length, 1);
}

export function gridFit(notes: RankerNote[], unit: number) {
  if (notes.length === 0) {
    return 0;
  }

  const total = notes.reduce((sum, note) => (
    sum +
    distanceToGrid(note.localStart, unit) +
    distanceToGrid(note.localStart + note.durationTicks, unit)
  ), 0);

  return total / (notes.length * 2);
}
