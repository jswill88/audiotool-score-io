import tonejsMidi from '@tonejs/midi';
import type { Midi as ToneMidi, Track as ToneTrack } from '@tonejs/midi';
import { AudiotoolProjectError } from './errors.js';
import {
  collectAudiotoolEntities,
  getEntityId,
  getField,
  getObjectField,
  locationKey,
  toFiniteNumber
} from './entities.js';
import {
  createProjectContext,
  getNotesForCollection,
  getRegionsForTrack,
  selectTracks
} from './tracks.js';
import {
  NotationStatuses,
  shouldExportTrackByDefault
} from './notation-classification.js';
import { audiotoolTicksToMidiTicks } from './ticks.js';
import type {
  AudiotoolEntity,
  AudiotoolMidiFile,
  AudiotoolMidiResult,
  AudiotoolOutputMode,
  AudiotoolProjectContext,
  AudiotoolProjectSource,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  ExportOptions,
  TrackSelection
} from './types.js';

const { Midi } = tonejsMidi;

const notationMidiChannels = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15];
const singleStaffMidiPrograms = [
  80, // lead 1 (square)
  81, // lead 2 (sawtooth)
  88, // pad 1 (new age)
  89, // pad 2 (warm)
  90, // pad 3 (polysynth)
  91, // pad 4 (choir)
  92, // pad 5 (bowed)
  93, // pad 6 (metallic)
  94, // pad 7 (halo)
  95 // pad 8 (sweep)
];

export const OutputModes = Object.freeze({
  Combined: 'combined',
  Separate: 'separate',
  Both: 'both'
} as const);

type BuildMidiParams = {
  context: AudiotoolProjectContext;
  tracks: AudiotoolTrackManifest[];
  options: ExportOptions;
  warnings: AudiotoolWarning[];
};

type FilterExportableTracksOptions = {
  options: ExportOptions;
  trackSelection: TrackSelection | undefined;
  warnings: AudiotoolWarning[];
};

type ExpandedNote = {
  pitch: number;
  positionTicks: number;
  durationTicks: number;
  velocity: number;
};

type RegionTiming = {
  regionStart: number;
  regionDuration: number;
  collectionOffset?: number;
  loopDuration?: number;
  localStart?: number;
};

export async function exportAudiotoolProjectToMidi(
  projectSource: Promise<AudiotoolProjectSource> | AudiotoolProjectSource,
  options: ExportOptions = {}
): Promise<AudiotoolMidiResult> {
  const source = await projectSource;
  return exportAudiotoolEntitiesToMidi(collectAudiotoolEntities(source), options);
}

export function exportAudiotoolEntitiesToMidi(
  entities: AudiotoolProjectSource,
  options: ExportOptions = {}
): AudiotoolMidiResult {
  const mode = normalizeMode(options.mode);
  const context = createProjectContext(collectAudiotoolEntities(entities), options);
  const trackSelection = options.tracks ?? options.trackIds;
  const selectedTracks = selectTracks(context, trackSelection);
  const warnings = [...context.warnings];
  const exportableTracks = filterExportableTracks(selectedTracks, {
    options,
    trackSelection,
    warnings
  });

  if (selectedTracks.length > 0 && exportableTracks.length === 0) {
    warnings.push({
      code: 'no-exportable-tracks',
      message: 'All selected Audiotool note tracks were empty, disabled, or skipped by export defaults.'
    });
  }

  addNotationWarnings(exportableTracks, warnings);

  if (exportableTracks.length === 0) {
    return {
      mode,
      files: [],
      tracks: selectedTracks,
      exportedTracks: exportableTracks,
      tempo: context.tempo,
      timeSignature: context.timeSignature,
      warnings
    };
  }

  const files: AudiotoolMidiFile[] = [];

  if (mode === OutputModes.Combined || mode === OutputModes.Both) {
    const midi = buildMidi({
      context,
      tracks: exportableTracks,
      options,
      warnings
    });

    files.push(createMidiFile({
      kind: 'score',
      name: options.combinedFileName ?? 'audiotool-score.mid',
      midi,
      trackIds: exportableTracks.map((track) => track.id)
    }));
  }

  if (mode === OutputModes.Separate || mode === OutputModes.Both) {
    for (const track of exportableTracks) {
      const midi = buildMidi({
        context,
        tracks: [track],
        options,
        warnings
      });

      files.push(createMidiFile({
        kind: 'part',
        name: buildPartFileName(track, options),
        midi,
        trackIds: [track.id]
      }));
    }
  }

  return {
    mode,
    files,
    tracks: selectedTracks,
    exportedTracks: exportableTracks,
    tempo: context.tempo,
    timeSignature: context.timeSignature,
    warnings
  };
}

export function createMidiFromAudiotoolEntities(
  entities: AudiotoolProjectSource,
  options: ExportOptions = {}
): ToneMidi {
  const context = createProjectContext(collectAudiotoolEntities(entities), options);
  const trackSelection = options.tracks ?? options.trackIds;
  const selectedTracks = selectTracks(context, trackSelection);
  const warnings: AudiotoolWarning[] = [];
  const exportableTracks = filterExportableTracks(selectedTracks, {
    options,
    trackSelection,
    warnings
  });

  return buildMidi({
    context,
    tracks: exportableTracks,
    options,
    warnings
  });
}

function filterExportableTracks(
  tracks: AudiotoolTrackManifest[],
  { options, trackSelection, warnings }: FilterExportableTracksOptions
) {
  const hasExplicitSelection = isExplicitTrackSelection(trackSelection);

  return tracks.filter((track) => {
    if (!track.hasNotes) {
      if (hasExplicitSelection) {
        warnings.push({
          code: 'track-empty',
          trackId: track.id,
          message: `${track.label} was skipped because it has no notes to export.`
        });
      }

      return false;
    }

    if (options.includeDisabledTracks !== true && track.isEnabled === false) {
      return false;
    }

    if (
      options.includeSkippedTracks !== true &&
      !hasExplicitSelection &&
      !shouldExportTrackByDefault(track)
    ) {
      warnings.push({
        code: 'track-skipped-by-default',
        trackId: track.id,
        kind: track.notation?.kind,
        message: `${track.label} was skipped because ${track.notation?.reason ?? 'it is not recommended for notation export'}`
      });
      return false;
    }

    return true;
  });
}

function addNotationWarnings(tracks: AudiotoolTrackManifest[], warnings: AudiotoolWarning[]) {
  for (const track of tracks) {
    if (track.notation?.status === NotationStatuses.Ready) {
      continue;
    }

    warnings.push({
      code: 'track-notation-warning',
      trackId: track.id,
      kind: track.notation.kind,
      message: `${track.label}: ${track.notation.reason}`
    });
  }
}

function isExplicitTrackSelection(selection: TrackSelection | undefined) {
  if (selection === undefined || selection === null) {
    return false;
  }

  if (Array.isArray(selection)) {
    return selection.length > 0;
  }

  return String(selection).trim().length > 0;
}

function buildMidi({ context, tracks, options, warnings }: BuildMidiParams): ToneMidi {
  const midi = new Midi();
  midi.header.name = options.title ?? 'Audiotool Export';
  midi.header.setTempo(context.tempo.bpm);
  midi.header.timeSignatures = [
    {
      ticks: 0,
      timeSignature: [
        context.timeSignature.numerator,
        context.timeSignature.denominator
      ]
    }
  ];
  midi.header.update();

  for (const [trackIndex, trackManifest] of tracks.entries()) {
    const track = midi.addTrack();
    track.name = resolveTrackTitle(trackManifest, options);
    applyNotationMidiIdentity(track, trackIndex);

    addNotesForTrack(track, trackManifest, context, options, warnings);
  }

  return midi;
}

function applyNotationMidiIdentity(track: ToneTrack, trackIndex: number) {
  track.channel = notationMidiChannels[trackIndex % notationMidiChannels.length];
  track.instrument.number = singleStaffMidiPrograms[
    Math.floor(trackIndex / notationMidiChannels.length) % singleStaffMidiPrograms.length
  ];
}

function addNotesForTrack(
  midiTrack: ToneTrack,
  trackManifest: AudiotoolTrackManifest,
  context: AudiotoolProjectContext,
  options: ExportOptions,
  warnings: AudiotoolWarning[]
) {
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
    const occurrences = expandRegionNotes(notes, region, {
      noteRegionId: getEntityId(noteRegion),
      trackId: trackManifest.id,
      warnings
    });

    for (const note of occurrences) {
      midiTrack.addNote({
        midi: note.pitch,
        ticks: audiotoolTicksToMidiTicks(note.positionTicks, options),
        durationTicks: Math.max(1, audiotoolTicksToMidiTicks(note.durationTicks, options)),
        velocity: note.velocity
      });
    }
  }
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

    if (!Number.isFinite(rawPitch) || !Number.isFinite(rawPosition) || !Number.isFinite(rawDuration)) {
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

    const duration = Math.max(0, rawDuration);
    const noteData = {
      pitch: clampMidiPitch(rawPitch),
      positionTicks: rawPosition,
      durationTicks: duration,
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

  return occurrences.sort((a, b) => a.positionTicks - b.positionTicks || a.pitch - b.pitch);
}

function addLoopedOccurrences(
  occurrences: ExpandedNote[],
  note: ExpandedNote,
  loop: Required<Pick<RegionTiming, 'regionStart' | 'regionDuration' | 'collectionOffset' | 'loopDuration'>>
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
  region: Required<Pick<RegionTiming, 'regionStart' | 'regionDuration' | 'localStart'>>
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

function createMidiFile({
  kind,
  name,
  midi,
  trackIds
}: {
  kind: AudiotoolMidiFile['kind'];
  name: string;
  midi: ToneMidi;
  trackIds: string[];
}): AudiotoolMidiFile {
  return {
    kind,
    name,
    title: midi.header.name || undefined,
    trackIds,
    midi,
    bytes: Uint8Array.from(midi.toArray())
  };
}

function buildPartFileName(track: AudiotoolTrackManifest, options: ExportOptions) {
  const label = resolveTrackTitle(track, options)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${label || track.id || 'track'}.mid`;
}

function resolveTrackTitle(track: AudiotoolTrackManifest, options: ExportOptions) {
  return options.trackTitles?.[track.id]?.trim() || track.label;
}

function normalizeMode(mode: ExportOptions['mode'] = OutputModes.Combined): AudiotoolOutputMode {
  if (Object.values(OutputModes).includes(mode as AudiotoolOutputMode)) {
    return mode as AudiotoolOutputMode;
  }

  throw new AudiotoolProjectError(
    `Invalid MIDI output mode "${mode}". Expected combined, separate, or both.`
  );
}

function isInsideLoop(positionTicks: number, loopOffset: number, loopDuration: number) {
  return positionTicks >= loopOffset && positionTicks < loopOffset + loopDuration;
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
