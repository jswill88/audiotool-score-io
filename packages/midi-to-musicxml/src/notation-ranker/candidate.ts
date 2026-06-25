import {
  createStandardDurations,
  nearestStandardDuration,
  nextStandardDuration
} from './durations.js';
import {
  groupEvents,
  normalizeChordClusters
} from './events.js';
import { clamp, roundToUnit } from './math.js';
import type {
  RankerEventGroup,
  RankerNote,
  RankerPlan,
  RankerPolicy
} from './types.js';

export function generateCandidate(
  notes: RankerNote[],
  plan: RankerPlan,
  {
    measureTicks,
    ppq
  }: {
    measureTicks: number;
    ppq: number;
  }
) {
  const unit = Math.max(1, Math.round(ppq / (plan.grid / 4)));
  const standardDurations = createStandardDurations(ppq);
  const adjusted = notes.map((note) => {
    const localStart = clamp(
      roundToUnit(note.localStart, unit),
      0,
      measureTicks - unit
    );
    const crossesMeasure = note.localStart + note.durationTicks > measureTicks;
    const quantizedEndpointDuration = Math.max(
      unit,
      roundToUnit(note.localStart + note.durationTicks, unit) - localStart
    );
    const maximum = Math.max(
      unit,
      measureTicks - localStart,
      quantizedEndpointDuration
    );
    const duration = crossesMeasure
      ? quantizedEndpointDuration
      : plan.policy === 'duration-snap-reconcile'
        ? nearestStandardDuration(
            note.durationTicks,
            unit,
            maximum,
            standardDurations
          )
        : plan.policy === 'duration-ceil-reconcile'
          ? nextStandardDuration(
              note.durationTicks,
              unit,
              maximum,
              standardDurations
            )
          : clamp(quantizedEndpointDuration, unit, maximum);

    return {
      ...note,
      localStart,
      durationTicks: duration
    };
  });

  if (isReconcilePolicy(plan.policy)) {
    normalizeChordClusters(adjusted, unit, ppq);
  }

  const groups = groupEvents(adjusted);

  reconcileAdjacentEvents(adjusted, groups, plan.policy, unit);
  reconcileMeasureEnd(adjusted, groups, plan.policy, measureTicks, unit);

  return adjusted.sort((left, right) => (
    left.localStart - right.localStart || left.pitch - right.pitch
  ));
}

function reconcileAdjacentEvents(
  notes: RankerNote[],
  groups: RankerEventGroup[],
  policy: RankerPolicy,
  unit: number
) {
  for (let index = 0; index < groups.length - 1; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];
    const groupEnd = Math.max(...group.noteIndexes.map((noteIndex) => (
      notes[noteIndex].localStart + notes[noteIndex].durationTicks
    )));
    const gap = next.start - groupEnd;

    if (policy === 'bridge-gaps' && gap > 0 && gap <= unit) {
      extendGroup(notes, group, gap);
    }

    if (policy === 'trim-overlaps' && gap < 0 && Math.abs(gap) <= unit) {
      endGroupAt(notes, group, next.start, unit);
    }

    if (isReconcilePolicy(policy) && Math.abs(gap) <= unit) {
      endGroupAt(notes, group, next.start, unit);
    }
  }
}

function reconcileMeasureEnd(
  notes: RankerNote[],
  groups: RankerEventGroup[],
  policy: RankerPolicy,
  measureTicks: number,
  unit: number
) {
  if (!isReconcilePolicy(policy) || groups.length === 0) {
    return;
  }

  const finalGroup = groups.at(-1)!;
  const finalEnd = Math.max(...finalGroup.noteIndexes.map((noteIndex) => (
    notes[noteIndex].localStart + notes[noteIndex].durationTicks
  )));
  const trailingGap = measureTicks - finalEnd;

  if (trailingGap > 0 && trailingGap <= unit) {
    extendGroup(notes, finalGroup, trailingGap);
  }
}

function extendGroup(
  notes: RankerNote[],
  group: RankerEventGroup,
  duration: number
) {
  for (const noteIndex of group.noteIndexes) {
    notes[noteIndex].durationTicks += duration;
  }
}

function endGroupAt(
  notes: RankerNote[],
  group: RankerEventGroup,
  end: number,
  minimumDuration: number
) {
  for (const noteIndex of group.noteIndexes) {
    notes[noteIndex].durationTicks = Math.max(
      minimumDuration,
      end - notes[noteIndex].localStart
    );
  }
}

function isReconcilePolicy(policy: RankerPolicy) {
  return policy === 'reconcile-jitter' ||
    policy === 'duration-snap-reconcile' ||
    policy === 'duration-ceil-reconcile';
}
