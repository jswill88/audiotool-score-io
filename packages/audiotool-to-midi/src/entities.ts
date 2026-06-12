import { AudiotoolProjectError } from './errors.js';
import type {
  AudiotoolEntity,
  AudiotoolEntityIndex,
  AudiotoolProjectSource,
  UnknownRecord
} from './types.js';

type ProjectSourceRecord = UnknownRecord & {
  entities?: unknown;
  document?: unknown;
  queryEntities?: unknown;
};

type EntityQuery = {
  get: () => AudiotoolEntity[];
};

type QueryEntities = {
  get?: () => AudiotoolEntity[];
  ofTypes?: (...types: string[]) => EntityQuery;
  ofTargetTypes?: (...types: string[]) => EntityQuery;
};

export const EntityTypes = Object.freeze({
  Config: 'config',
  Note: 'note',
  NoteCollection: 'noteCollection',
  NoteRegion: 'noteRegion',
  NoteTrack: 'noteTrack',
  TempoAutomationTrack: 'tempoAutomationTrack'
} as const);

export const noteEntityTypes = Object.freeze([
  EntityTypes.NoteTrack,
  EntityTypes.NoteRegion,
  EntityTypes.NoteCollection,
  EntityTypes.Note,
  EntityTypes.Config,
  EntityTypes.TempoAutomationTrack
]);

export function collectAudiotoolEntities(source: AudiotoolProjectSource): AudiotoolEntity[] {
  if (!source) {
    throw new AudiotoolProjectError('Audiotool project source is required.');
  }

  if (Array.isArray(source)) {
    return source;
  }

  if (!isRecord(source)) {
    throw new AudiotoolProjectError(
      'Expected an entity array, an object with entities, or a Nexus document.'
    );
  }

  const projectSource = source as ProjectSourceRecord;

  if (Array.isArray(projectSource.entities)) {
    return projectSource.entities;
  }

  if (isRecord(projectSource.document) && Array.isArray(projectSource.document.entities)) {
    return projectSource.document.entities;
  }

  if (projectSource.queryEntities) {
    return collectFromQuery(projectSource.queryEntities);
  }

  throw new AudiotoolProjectError(
    'Expected an entity array, an object with entities, or a Nexus document.'
  );
}

export function getEntityId(entity: AudiotoolEntity | null | undefined): string | null {
  return (
    entity?.id ??
    entity?.uuid ??
    entity?.entityId ??
    entity?.location?.entityId ??
    entity?.fields?.id?.value ??
    null
  );
}

export function getEntityType(entity: AudiotoolEntity | null | undefined): string | null {
  return (
    entity?.type ??
    entity?.key ??
    entity?.entityType ??
    entity?.location?.entityType ??
    null
  );
}

export function locationEntityType(value: unknown): string | null {
  const unwrapped = unwrapFieldValue<unknown>(value, value);

  if (!isRecord(unwrapped)) {
    return null;
  }

  if (unwrapped.entityType) {
    return String(unwrapped.entityType);
  }

  if (unwrapped.location) {
    return locationEntityType(unwrapped.location);
  }

  if (unwrapped.value && unwrapped.value !== unwrapped) {
    return locationEntityType(unwrapped.value);
  }

  return null;
}

export function getField<T = any>(
  entity: AudiotoolEntity | null | undefined,
  fieldName: string,
  fallback: T | undefined = undefined
): T {
  const fields = entity?.fields;

  if (fields && Object.hasOwn(fields, fieldName)) {
    return unwrapFieldValue(fields[fieldName], fallback);
  }

  if (entity && Object.hasOwn(entity, fieldName)) {
    return unwrapFieldValue(entity[fieldName], fallback);
  }

  return fallback as T;
}

export function getObjectField(
  entity: AudiotoolEntity | null | undefined,
  fieldName: string,
  fallback: AudiotoolEntity = {}
): AudiotoolEntity {
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

export function locationKey(value: unknown): string | null {
  const unwrapped = unwrapFieldValue<unknown>(value, value);

  if (!unwrapped) {
    return null;
  }

  if (typeof unwrapped === 'string') {
    return unwrapped;
  }

  if (!isRecord(unwrapped)) {
    return String(unwrapped);
  }

  if (unwrapped.entityId) {
    return String(unwrapped.entityId);
  }

  if (unwrapped.id) {
    return String(unwrapped.id);
  }

  if (unwrapped.uuid) {
    return String(unwrapped.uuid);
  }

  if (unwrapped.location) {
    return locationKey(unwrapped.location);
  }

  if (unwrapped.value && unwrapped.value !== unwrapped) {
    return locationKey(unwrapped.value);
  }

  return null;
}

export function buildEntityIndex(entities: AudiotoolEntity[]): AudiotoolEntityIndex {
  const byId = new Map<string, AudiotoolEntity>();
  const byType = new Map<string, AudiotoolEntity[]>();

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

export function getEntityByLocation(index: AudiotoolEntityIndex, value: unknown) {
  const key = locationKey(value);
  return key ? index.byId.get(key) : undefined;
}

export function toFiniteNumber(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function collectFromQuery(queryEntities: unknown): AudiotoolEntity[] {
  if (!isQueryEntities(queryEntities)) {
    throw new AudiotoolProjectError('Nexus document does not expose queryable entities.');
  }

  if (typeof queryEntities.get === 'function') {
    return queryEntities.get();
  }

  if (typeof queryEntities.ofTypes === 'function') {
    const entities: AudiotoolEntity[] = [];
    const seen = new Set();
    const pushEntity = (entity: AudiotoolEntity) => {
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

function isQueryEntities(value: unknown): value is QueryEntities {
  return isRecord(value);
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object';
}

function unwrapFieldValue<T = any>(field: unknown, fallback: T | undefined = undefined): T {
  if (field === undefined || field === null) {
    return fallback as T;
  }

  if (typeof field !== 'object') {
    return field as T;
  }

  if ('value' in field) {
    return field.value as T;
  }

  if ('current' in field) {
    return field.current as T;
  }

  return field as T;
}

function unwrapFieldMap(fields: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, unwrapFieldValue(value)])
  );
}

function unwrapObject(value: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'location')
      .map(([key, item]) => [key, unwrapFieldValue(item)])
  );
}
