import {
  EntityTypes,
  buildEntityIndex,
  collectAudiotoolEntities,
  getEntityByLocation,
  getEntityId,
  getField,
  getObjectField,
  locationKey,
  toFiniteNumber
} from './entities.js';
import { AudiotoolProjectError } from './errors.js';

export function inspectAudiotoolProject(projectSource, options = {}) {
  const entities = collectAudiotoolEntities(projectSource);
  return inspectAudiotoolEntities(entities, options);
}

export function inspectAudiotoolEntities(entities, options = {}) {
  const context = createProjectContext(entities, options);
  const tracks = context.noteTracks.map((track) => buildTrackManifest(track, context));

  return {
    tracks,
    tempo: context.tempo,
    timeSignature: context.timeSignature,
    totals: {
      noteTracks: tracks.length,
      noteRegions: context.noteRegions.length,
      notes: context.notes.length
    },
    warnings: context.warnings
  };
}

export function createProjectContext(entities, options = {}) {
  const index = buildEntityIndex(entities);
  const noteTracks = sortTracks(index.byType.get(EntityTypes.NoteTrack) ?? []);
  const noteRegions = index.byType.get(EntityTypes.NoteRegion) ?? [];
  const notes = index.byType.get(EntityTypes.Note) ?? [];
  const warnings = [];
  const tempo = extractTempo(index, options);
  const timeSignature = extractTimeSignature(index, options);

  if ((index.byType.get(EntityTypes.TempoAutomationTrack) ?? []).length > 0) {
    warnings.push({
      code: 'tempo-automation-unsupported',
      message: 'Tempo automation exists but only the project/base tempo is exported in this version.'
    });
  }

  return {
    entities,
    index,
    noteTracks,
    noteRegions,
    notes,
    tempo,
    timeSignature,
    warnings
  };
}

export function selectTracks(context, selection = undefined) {
  const tracks = context.noteTracks.map((track) => buildTrackManifest(track, context));

  if (!selection || selection.length === 0 || selection === 'all') {
    return tracks;
  }

  const selected = new Set(Array.isArray(selection) ? selection.map(String) : [String(selection)]);
  const byId = new Map(tracks.map((track) => [track.id, track]));
  const byOrder = new Map(tracks.map((track) => [String(track.order), track]));
  const chosen = [];

  for (const key of selected) {
    const track = byId.get(key) ?? byOrder.get(key);

    if (!track) {
      throw new AudiotoolProjectError(`No Audiotool note track matches selection "${key}".`);
    }

    if (!chosen.some((existing) => existing.id === track.id)) {
      chosen.push(track);
    }
  }

  return chosen;
}

export function getRegionsForTrack(trackId, context) {
  return context.noteRegions
    .filter((regionEntity) => locationKey(getField(regionEntity, 'track')) === trackId)
    .sort((a, b) => {
      const aRegion = getObjectField(a, 'region');
      const bRegion = getObjectField(b, 'region');
      return toFiniteNumber(aRegion.positionTicks) - toFiniteNumber(bRegion.positionTicks);
    });
}

export function getNotesForCollection(collectionId, context) {
  return context.notes
    .filter((note) => locationKey(getField(note, 'collection')) === collectionId)
    .sort((a, b) => toFiniteNumber(getField(a, 'positionTicks')) - toFiniteNumber(getField(b, 'positionTicks')));
}

function buildTrackManifest(track, context) {
  const id = getEntityId(track);
  const order = toFiniteNumber(getField(track, 'orderAmongTracks'), 0);
  const isEnabled = getField(track, 'isEnabled', true) !== false;
  const playerLocation = getField(track, 'player');
  const playerId = locationKey(playerLocation);
  const player = getEntityByLocation(context.index, playerLocation);
  const playerType = player ? getField(player, 'type', undefined) ?? player.type : null;
  const playerName = player ? getPlayerName(player) : playerId;
  const regions = getRegionsForTrack(id, context);
  const noteCount = regions.reduce((total, region) => {
    const collectionId = locationKey(getField(region, 'collection'));
    return total + getNotesForCollection(collectionId, context).length;
  }, 0);

  return {
    id,
    order,
    playerId,
    playerType,
    playerName,
    label: buildTrackLabel(order, playerName, id),
    isEnabled,
    regionCount: regions.length,
    noteCount,
    regionIds: regions.map((region) => getEntityId(region)).filter(Boolean)
  };
}

function sortTracks(tracks) {
  return [...tracks].sort((a, b) => {
    const aOrder = toFiniteNumber(getField(a, 'orderAmongTracks'), 0);
    const bOrder = toFiniteNumber(getField(b, 'orderAmongTracks'), 0);

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return String(getEntityId(a)).localeCompare(String(getEntityId(b)));
  });
}

function getPlayerName(player) {
  return (
    getField(player, 'displayName') ??
    getField(player, 'presetName') ??
    getField(player, 'name') ??
    getEntityId(player)
  );
}

function buildTrackLabel(order, playerName, id) {
  const trackPrefix = Number.isFinite(order) ? `Track ${order}` : 'Track';
  return playerName ? `${trackPrefix} - ${playerName}` : `${trackPrefix} - ${id}`;
}

function extractTempo(index, options) {
  if (options.tempo) {
    return normalizeTempo(options.tempo);
  }

  const config = (index.byType.get(EntityTypes.Config) ?? [])[0];
  const bpm = firstFiniteField(config, ['bpm', 'tempo', 'tempoBpm', 'beatsPerMinute']);

  return {
    bpm: bpm ?? 120
  };
}

function extractTimeSignature(index, options) {
  if (options.timeSignature) {
    return normalizeTimeSignature(options.timeSignature);
  }

  const config = (index.byType.get(EntityTypes.Config) ?? [])[0];
  const numerator = firstFiniteField(config, [
    'signatureNumerator',
    'timeSignatureNumerator',
    'beatsPerBar',
    'numerator'
  ]);
  const denominator = firstFiniteField(config, [
    'signatureDenominator',
    'timeSignatureDenominator',
    'beatUnit',
    'denominator'
  ]);

  return {
    numerator: numerator ?? 4,
    denominator: denominator ?? 4
  };
}

function normalizeTempo(tempo) {
  if (typeof tempo === 'number') {
    return { bpm: tempo };
  }

  return {
    bpm: toFiniteNumber(tempo?.bpm, 120)
  };
}

function normalizeTimeSignature(timeSignature) {
  if (Array.isArray(timeSignature)) {
    return {
      numerator: toFiniteNumber(timeSignature[0], 4),
      denominator: toFiniteNumber(timeSignature[1], 4)
    };
  }

  return {
    numerator: toFiniteNumber(timeSignature?.numerator, 4),
    denominator: toFiniteNumber(timeSignature?.denominator, 4)
  };
}

function firstFiniteField(entity, fieldNames) {
  for (const fieldName of fieldNames) {
    const value = Number(getField(entity, fieldName));

    if (Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}
