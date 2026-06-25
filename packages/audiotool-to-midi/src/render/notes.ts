import {
  getEntityId,
  getField,
  getObjectField,
  locationKey,
  toFiniteNumber
} from '../entities.js';
import {
  getNotesForCollection,
  getRegionsForTrack
} from '../tracks.js';
import type {
  AudiotoolEntity,
  AudiotoolProjectContext,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  ExportOptions
} from '../types.js';
import type {
  ExpandedNote,
  RegionTiming
} from './types.js';

export function collectExpandedNotesForTrack(
  trackManifest: AudiotoolTrackManifest,
  context: AudiotoolProjectContext,
  options: ExportOptions,
  warnings: AudiotoolWarning[]
) {
  const occurrences: ExpandedNote[] = [];
  const regions = getRegionsForTrack(trackManifest.id, context);

  for (const noteRegion of regions) {
    const region = getObjectField(noteRegion, 'region');

    if (region.isEnabled === false && options.includeDisabledRegions !== true) {
      continue;
    }

    const collectionId = locationKey(getField(noteRegion, 'collection'));

    if (!collectionId) {
      warnings.push({
        code: 'note-region-missing-collection',
        entityId: getEntityId(noteRegion),
        trackId: trackManifest.id,
        message: 'A note region has no note collection pointer and was skipped.'
      });
      continue;
    }

    const notes = getNotesForCollection(collectionId, context);
    occurrences.push(...expandRegionNotes(notes, region, {
      noteRegionId: getEntityId(noteRegion),
      trackId: trackManifest.id,
      warnings
    }));
  }

  return occurrences.sort((left, right) => (
    left.positionTicks - right.positionTicks || left.pitch - right.pitch
  ));
}

function expandRegionNotes(
  notes: AudiotoolEntity[],
  region: AudiotoolEntity,
  context: {
    noteRegionId: string | null;
    trackId: string;
    warnings: AudiotoolWarning[];
  }
): ExpandedNote[] {
  const regionStart = nonNegativeNumber(region.positionTicks);
  const regionDuration = nonNegativeNumber(region.durationTicks);
  const collectionOffset = nonNegativeNumber(region.collectionOffsetTicks);
  const loopOffset = nonNegativeNumber(region.loopOffsetTicks);
  const loopDuration = nonNegativeNumber(region.loopDurationTicks);
  const hasLoop = loopDuration > 0;
  const occurrences: ExpandedNote[] = [];

  if (regionDuration <= 0) {
    return occurrences;
  }

  for (const note of notes) {
    const rawPitch = Number(getField(note, 'pitch'));
    const rawPosition = Number(getField(note, 'positionTicks'));
    const rawDuration = Number(getField(note, 'durationTicks'));

    if (
      !Number.isFinite(rawPitch) ||
      !Number.isFinite(rawPosition) ||
      !Number.isFinite(rawDuration)
    ) {
      context.warnings.push({
        code: 'invalid-note',
        entityId: getEntityId(note),
        noteRegionId: context.noteRegionId,
        trackId: context.trackId,
        message: 'A note has invalid pitch or timing and was skipped.'
      });
      continue;
    }

    if (getField(note, 'doesSlide') === true) {
      context.warnings.push({
        code: 'slide-note-unsupported',
        entityId: getEntityId(note),
        noteRegionId: context.noteRegionId,
        trackId: context.trackId,
        message: 'A slide note was exported as a plain MIDI note.'
      });
    }

    const noteData = {
      pitch: clampMidiPitch(rawPitch),
      positionTicks: rawPosition,
      durationTicks: Math.max(0, rawDuration),
      velocity: clampVelocity(getField(note, 'velocity', 1))
    };

    if (hasLoop && isInsideLoop(rawPosition, loopOffset, loopDuration)) {
      addLoopedOccurrences(occurrences, noteData, {
        regionStart,
        regionDuration,
        collectionOffset,
        loopDuration
      });
    } else {
      addClippedOccurrence(occurrences, noteData, {
        regionStart,
        regionDuration,
        localStart: rawPosition - collectionOffset
      });
    }
  }

  return occurrences.sort((left, right) => (
    left.positionTicks - right.positionTicks || left.pitch - right.pitch
  ));
}

function addLoopedOccurrences(
  occurrences: ExpandedNote[],
  note: ExpandedNote,
  loop: Required<
    Pick<
      RegionTiming,
      'regionStart' | 'regionDuration' | 'collectionOffset' | 'loopDuration'
    >
  >
) {
  const baseLocalStart = note.positionTicks - loop.collectionOffset;
  let iteration = Math.floor(-baseLocalStart / loop.loopDuration);

  if (iteration < 0) {
    iteration = 0;
  }

  while (true) {
    const localStart = baseLocalStart + iteration * loop.loopDuration;

    if (localStart >= loop.regionDuration) {
      break;
    }

    addClippedOccurrence(occurrences, note, {
      regionStart: loop.regionStart,
      regionDuration: loop.regionDuration,
      localStart
    });
    iteration += 1;
  }
}

function addClippedOccurrence(
  occurrences: ExpandedNote[],
  note: ExpandedNote,
  region: Required<
    Pick<RegionTiming, 'regionStart' | 'regionDuration' | 'localStart'>
  >
) {
  const localStart = region.localStart;
  const localEnd = localStart + note.durationTicks;

  if (localEnd <= 0 || localStart >= region.regionDuration) {
    return;
  }

  const clippedLocalStart = Math.max(0, localStart);
  const clippedLocalEnd = Math.min(region.regionDuration, localEnd);
  const durationTicks = clippedLocalEnd - clippedLocalStart;

  if (durationTicks <= 0) {
    return;
  }

  occurrences.push({
    pitch: note.pitch,
    positionTicks: region.regionStart + clippedLocalStart,
    durationTicks,
    velocity: note.velocity
  });
}

function isInsideLoop(
  positionTicks: number,
  loopOffset: number,
  loopDuration: number
) {
  return positionTicks >= loopOffset &&
    positionTicks < loopOffset + loopDuration;
}

function nonNegativeNumber(value: unknown) {
  return Math.max(0, toFiniteNumber(value, 0));
}

function clampVelocity(value: unknown) {
  return Math.min(1, Math.max(0, toFiniteNumber(value, 1)));
}

function clampMidiPitch(value: unknown) {
  return Math.min(127, Math.max(0, Math.round(toFiniteNumber(value, 60))));
}
