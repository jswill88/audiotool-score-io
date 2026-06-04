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

export { exportAudiotoolProjectToMidi as extractAudiotoolProjectToMidi } from './render.js';

export async function createMidiFromAudiotoolProject(projectSource, options = {}) {
  const { createMidiFromAudiotoolEntities } = await import('./render.js');
  return createMidiFromAudiotoolEntities(projectSource, options);
}
