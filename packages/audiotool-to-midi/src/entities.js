import { AudiotoolProjectError } from './errors.js';

export const EntityTypes = Object.freeze({
  Config: 'config',
  Note: 'note',
  NoteCollection: 'noteCollection',
  NoteRegion: 'noteRegion',
  NoteTrack: 'noteTrack',
  TempoAutomationTrack: 'tempoAutomationTrack'
});

export const noteEntityTypes = Object.freeze([
  EntityTypes.NoteTrack,
  EntityTypes.NoteRegion,
  EntityTypes.NoteCollection,
  EntityTypes.Note,
  EntityTypes.Config,
  EntityTypes.TempoAutomationTrack
]);

export function collectAudiotoolEntities(source) {
  if (!source) {
    throw new AudiotoolProjectError('Audiotool project source is required.');
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (Array.isArray(source.entities)) {
    return source.entities;
  }

  if (Array.isArray(source.document?.entities)) {
    return source.document.entities;
  }

  if (source.queryEntities) {
    return collectFromQuery(source.queryEntities);
  }

  throw new AudiotoolProjectError(
    'Expected an entity array, an object with entities, or a Nexus document.'
  );
}

export function getEntityId(entity) {
  return (
    entity?.id ??
    entity?.uuid ??
    entity?.entityId ??
    entity?.location?.entityId ??
    entity?.fields?.id?.value ??
    null
  );
}

export function getEntityType(entity) {
  return (
    entity?.type ??
    entity?.key ??
    entity?.entityType ??
    entity?.location?.entityType ??
    null
  );
}

export function locationEntityType(value) {
  const unwrapped = unwrapFieldValue(value, value);

  if (!unwrapped || typeof unwrapped !== 'object') {
    return null;
  }

  if (unwrapped.entityType) {
    return unwrapped.entityType;
  }

  if (unwrapped.location) {
    return locationEntityType(unwrapped.location);
  }

  if (unwrapped.value && unwrapped.value !== unwrapped) {
    return locationEntityType(unwrapped.value);
  }

  return null;
}

export function getField(entity, fieldName, fallback = undefined) {
  const fields = entity?.fields;

  if (fields && Object.hasOwn(fields, fieldName)) {
    return unwrapFieldValue(fields[fieldName], fallback);
  }

  if (entity && Object.hasOwn(entity, fieldName)) {
    return unwrapFieldValue(entity[fieldName], fallback);
  }

  return fallback;
}

export function getObjectField(entity, fieldName, fallback = {}) {
  const field = entity?.fields?.[fieldName] ?? entity?.[fieldName];
  const value = unwrapFieldValue(field, fallback);

  if (!value || typeof value !== 'object') {
    return fallback;
  }

  if (value.fields && typeof value.fields === 'object') {
    return unwrapFieldMap(value.fields);
  }

  return unwrapObject(value);
}

export function locationKey(value) {
  const unwrapped = unwrapFieldValue(value, value);

  if (!unwrapped) {
    return null;
  }

  if (typeof unwrapped === 'string') {
    return unwrapped;
  }

  if (typeof unwrapped !== 'object') {
    return String(unwrapped);
  }

  if (unwrapped.entityId) {
    return unwrapped.entityId;
  }

  if (unwrapped.id) {
    return unwrapped.id;
  }

  if (unwrapped.uuid) {
    return unwrapped.uuid;
  }

  if (unwrapped.location) {
    return locationKey(unwrapped.location);
  }

  if (unwrapped.value && unwrapped.value !== unwrapped) {
    return locationKey(unwrapped.value);
  }

  return null;
}

export function buildEntityIndex(entities) {
  const byId = new Map();
  const byType = new Map();

  for (const entity of entities) {
    const id = getEntityId(entity);
    const type = getEntityType(entity);

    if (id) {
      byId.set(id, entity);
    }

    if (type) {
      const group = byType.get(type) ?? [];
      group.push(entity);
      byType.set(type, group);
    }
  }

  return { byId, byType };
}

export function getEntityByLocation(index, value) {
  const key = locationKey(value);
  return key ? index.byId.get(key) : undefined;
}

export function toFiniteNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function collectFromQuery(queryEntities) {
  if (typeof queryEntities.get === 'function') {
    return queryEntities.get();
  }

  if (typeof queryEntities.ofTypes === 'function') {
    const entities = [];
    const seen = new Set();
    const pushEntity = (entity) => {
      const id = getEntityId(entity) ?? entity;

      if (seen.has(id)) {
        return;
      }

      seen.add(id);
      entities.push(entity);
    };

    queryEntities.ofTypes(...noteEntityTypes).get().forEach(pushEntity);

    if (typeof queryEntities.ofTargetTypes === 'function') {
      queryEntities.ofTargetTypes('NoteTrackPlayer').get().forEach(pushEntity);
    }

    return entities;
  }

  throw new AudiotoolProjectError('Nexus document does not expose queryable entities.');
}

function unwrapFieldValue(field, fallback = undefined) {
  if (field === undefined || field === null) {
    return fallback;
  }

  if (typeof field !== 'object') {
    return field;
  }

  if ('value' in field) {
    return field.value;
  }

  if ('current' in field) {
    return field.current;
  }

  return field;
}

function unwrapFieldMap(fields) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, unwrapFieldValue(value)])
  );
}

function unwrapObject(value) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'location')
      .map(([key, item]) => [key, unwrapFieldValue(item)])
  );
}
