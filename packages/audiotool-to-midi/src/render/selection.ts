import { AudiotoolProjectError } from '../errors.js';
import {
  NotationStatuses,
  shouldExportTrackByDefault
} from '../notation-classification.js';
import type {
  AudiotoolOutputMode,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  ExportOptions,
  TrackSelection
} from '../types.js';
import type { FilterExportableTracksOptions } from './types.js';

export const OutputModes = Object.freeze({
  Combined: 'combined',
  Separate: 'separate',
  Both: 'both'
} as const);

export function filterExportableTracks(
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
        message: `${track.label} was skipped because ${
          track.notation?.reason ??
          'it is not recommended for notation export'
        }`
      });
      return false;
    }

    return true;
  });
}

export function addNotationWarnings(
  tracks: AudiotoolTrackManifest[],
  warnings: AudiotoolWarning[]
) {
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

export function normalizeMode(
  mode: ExportOptions['mode'] = OutputModes.Combined
): AudiotoolOutputMode {
  if (Object.values(OutputModes).includes(mode as AudiotoolOutputMode)) {
    return mode as AudiotoolOutputMode;
  }

  throw new AudiotoolProjectError(
    `Invalid MIDI output mode "${mode}". Expected combined, separate, or both.`
  );
}

function isExplicitTrackSelection(
  selection: TrackSelection | undefined
) {
  if (selection === undefined || selection === null) {
    return false;
  }

  if (Array.isArray(selection)) {
    return selection.length > 0;
  }

  return String(selection).trim().length > 0;
}
