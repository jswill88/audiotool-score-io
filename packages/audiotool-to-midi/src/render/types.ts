import type {
  AudiotoolProjectContext,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  ExportOptions,
  TrackSelection
} from '../types.js';

export type BuildMidiParams = {
  context: AudiotoolProjectContext;
  tracks: AudiotoolTrackManifest[];
  options: ExportOptions;
  warnings: AudiotoolWarning[];
};

export type FilterExportableTracksOptions = {
  options: ExportOptions;
  trackSelection: TrackSelection | undefined;
  warnings: AudiotoolWarning[];
};

export type ExpandedNote = {
  pitch: number;
  positionTicks: number;
  durationTicks: number;
  velocity: number;
};

export type RegionTiming = {
  regionStart: number;
  regionDuration: number;
  collectionOffset?: number;
  loopDuration?: number;
  localStart?: number;
};
