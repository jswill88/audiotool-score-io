export {
  AudiotoolExportNotImplementedError,
  AudiotoolProjectError,
  AudiotoolSdkUnavailableError,
  AudiotoolToMidiError
} from './errors.js';
export {
  EntityTypes,
  buildEntityIndex,
  collectAudiotoolEntities,
  getEntityByLocation,
  getEntityId,
  getEntityType,
  getField,
  getObjectField,
  locationKey
} from './entities.js';
export {
  createProjectContext,
  getNotesForCollection,
  getRegionsForTrack,
  inspectAudiotoolEntities,
  inspectAudiotoolProject,
  selectTracks
} from './tracks.js';
export {
  OutputModes,
  createMidiFromAudiotoolEntities,
  exportAudiotoolEntitiesToMidi,
  exportAudiotoolProjectToMidi
} from './render.js';
export {
  exportAudiotoolEntitiesToDirectMusicXml,
  exportAudiotoolProjectToDirectMusicXml
} from './direct-musicxml.js';
export {
  NotationKinds,
  NotationStatuses,
  classifyTrackForNotation,
  shouldExportTrackByDefault
} from './notation-classification.js';
export {
  audiotoolProjectReferenceToName,
  audiotoolProjectReferenceToOpenReference,
  parseAudiotoolProjectReference
} from './project-reference.js';
export {
  createAudiotoolSession,
  getAudiotoolProjectDetails,
  inspectAudiotoolProjectReference,
  listAudiotoolProjects,
  openAudiotoolProject,
  withAudiotoolProject
} from './session.js';
export {
  AudiotoolTicks,
  audiotoolTicksToMidiTicks,
  defaultMidiPpq,
  midiTicksToAudiotoolTicks
} from './ticks.js';
export type {
  AudiotoolAuthOptions,
  AudiotoolClient,
  AudiotoolClientLike,
  AudiotoolDirectMusicXmlFile,
  AudiotoolDirectMusicXmlResult,
  AudiotoolDocument,
  AudiotoolEntity,
  AudiotoolEntityIndex,
  AudiotoolLocation,
  AudiotoolMidiFile,
  AudiotoolMidiResult,
  AudiotoolOutputMode,
  AudiotoolProjectContext,
  AudiotoolProjectDetails,
  AudiotoolProjectListResult,
  AudiotoolProjectManifest,
  AudiotoolProjectReference,
  AudiotoolProjectSource,
  AudiotoolTempo,
  AudiotoolTimeSignature,
  AudiotoolTrackManifest,
  AudiotoolWarning,
  DirectMusicXmlOptions,
  ExportOptions,
  InspectOptions,
  NotationClassification,
  NotationKind,
  NotationStatus,
  OpenProjectOptions,
  ProjectLike,
  ProjectListOptions,
  ProjectReferenceType,
  TicksOptions,
  TrackSelection,
  UnknownRecord
} from './types.js';

export { exportAudiotoolProjectToMidi as extractAudiotoolProjectToMidi } from './render.js';

import type { Midi } from '@tonejs/midi';
import type { AudiotoolProjectSource, ExportOptions } from './types.js';

export async function createMidiFromAudiotoolProject(
  projectSource: AudiotoolProjectSource,
  options: ExportOptions = {}
): Promise<Midi> {
  const { createMidiFromAudiotoolEntities } = await import('./render.js');
  return createMidiFromAudiotoolEntities(projectSource, options);
}
