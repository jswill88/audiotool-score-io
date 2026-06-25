import type { Midi as ToneMidi } from '@tonejs/midi';
import { collectAudiotoolEntities } from '../entities.js';
import {
  createProjectContext,
  selectTracks
} from '../tracks.js';
import type {
  AudiotoolMidiFile,
  AudiotoolMidiResult,
  AudiotoolProjectSource,
  AudiotoolWarning,
  ExportOptions
} from '../types.js';
import {
  buildMidi,
  buildPartFileName,
  createMidiFile
} from './midi.js';
import {
  addNotationWarnings,
  filterExportableTracks,
  normalizeMode,
  OutputModes
} from './selection.js';

export { OutputModes } from './selection.js';

export async function exportAudiotoolProjectToMidi(
  projectSource: Promise<AudiotoolProjectSource> | AudiotoolProjectSource,
  options: ExportOptions = {}
): Promise<AudiotoolMidiResult> {
  const source = await projectSource;
  return exportAudiotoolEntitiesToMidi(
    collectAudiotoolEntities(source),
    options
  );
}

export function exportAudiotoolEntitiesToMidi(
  entities: AudiotoolProjectSource,
  options: ExportOptions = {}
): AudiotoolMidiResult {
  const mode = normalizeMode(options.mode);
  const context = createProjectContext(
    collectAudiotoolEntities(entities),
    options
  );
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
  const context = createProjectContext(
    collectAudiotoolEntities(entities),
    options
  );
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
