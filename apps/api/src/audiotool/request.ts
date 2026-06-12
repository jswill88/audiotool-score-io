import { createAudiotoolSession } from '@midi-to-xml/audiotool-to-midi';
import type { Request } from 'express';
import {
  audiotoolClientId,
  audiotoolPat
} from '../config/env.js';
import { ClientError } from '../errors/client-error.js';
import {
  parseQuantizationEnabled,
  parseQuantizationGrid,
  queryValue
} from '../utils/query.js';
import type {
  AudiotoolAuth,
  AudiotoolBrowserAuth,
  AudiotoolClient,
  AudiotoolOutputMode,
  AudiotoolProjectListResult,
  ConversionRequestOptions,
  InspectOptions,
  ProjectListOptions,
  ScoreImportRequestOptions
} from '../types.js';

export async function createRequestAudiotoolSession(req: Request): Promise<AudiotoolClient> {
  return createAudiotoolSession(readAudiotoolAuth(req));
}

export function readProjectReference(req: Request): string {
  const project = req.body?.projectUrl ??
    req.body?.projectReference ??
    req.body?.project ??
    queryValue(req.query.project, 'project');

  if (!project || typeof project !== 'string') {
    throw new ClientError('Audiotool project URL, UUID, or projects/{id} reference is required.');
  }

  return project;
}

export function readInspectOptions(req: Request): InspectOptions {
  return {
    includeDetails: readBooleanBody(req.body?.includeDetails, true, 'includeDetails'),
    start: readBooleanBody(req.body?.start, true, 'start'),
    stop: readBooleanBody(req.body?.stop, true, 'stop')
  };
}

export function readProjectListOptions(req: Request): ProjectListOptions {
  return {
    pageSize: readPositiveInteger(req.body?.pageSize, 25, 'pageSize'),
    pageToken: stringifyOptional(req.body?.pageToken) ?? '',
    orderBy: stringifyOptional(req.body?.orderBy) ?? 'project.update_time desc',
    filter: stringifyOptional(req.body?.filter) ?? ''
  };
}

export function readConversionRequestOptions(req: Request): ConversionRequestOptions {
  return {
    mode: readAudiotoolOutputMode(req.body?.mode ?? req.body?.outputMode ?? req.query.mode),
    tracks: readTrackSelection(req.body?.tracks ?? req.body?.trackIds),
    title: stringifyOptional(req.body?.title)?.trim() || undefined,
    trackTitles: readTrackTitles(req.body?.trackTitles ?? req.body?.trackNames),
    includeDisabledTracks: readBooleanBody(
      req.body?.includeDisabledTracks,
      false,
      'includeDisabledTracks'
    ),
    includeDisabledRegions: readBooleanBody(
      req.body?.includeDisabledRegions,
      false,
      'includeDisabledRegions'
    ),
    includeSkippedTracks: readBooleanBody(
      req.body?.includeSkippedTracks,
      false,
      'includeSkippedTracks'
    ),
    includeMidi: readBooleanBody(req.body?.includeMidi, false, 'includeMidi'),
    forceZip: readBooleanBody(req.body?.forceZip, false, 'forceZip'),
    start: readBooleanBody(req.body?.start, true, 'start'),
    stop: readBooleanBody(req.body?.stop, true, 'stop'),
    quantize: parseQuantizationEnabled({
      preprocess: stringifyOptional(req.body?.preprocess ?? queryValue(req.query.preprocess, 'preprocess')),
      quantize: stringifyOptional(req.body?.quantize ?? queryValue(req.query.quantize, 'quantize'))
    }),
    grid: parseQuantizationGrid(
      stringifyOptional(req.body?.grid ?? queryValue(req.query.grid, 'grid'))
    )
  };
}

export function readScoreImportRequestOptions(req: Request): ScoreImportRequestOptions {
  return {
    dryRun: readBooleanBody(req.body?.dryRun, false, 'dryRun'),
    title: stringifyOptional(req.body?.title)?.trim() || undefined,
    selectedPartIds: readStringSelection(req.body?.parts ?? req.body?.partIds),
    partTitles: readStringMap(req.body?.partTitles ?? req.body?.partNames, 'partTitles'),
    projectTemplateName: stringifyOptional(req.body?.projectTemplateName)?.trim() || undefined,
    maxImportedNotes: readOptionalPositiveInteger(req.body?.maxImportedNotes, 'maxImportedNotes')
  };
}

export function throwIfAudiotoolServiceError(
  result: AudiotoolProjectListResult
): asserts result is Exclude<AudiotoolProjectListResult, Error> {
  if (!(result instanceof Error)) {
    return;
  }

  const cause = result.cause;
  const causeMessage = cause instanceof Error ? cause.message : undefined;
  const message = causeMessage ?? result.message;
  const statusCode = message.includes('unauthenticated') ? 401 : 502;
  throw new ClientError(message, statusCode);
}

function readAudiotoolAuth(req: Request): AudiotoolAuth {
  const tokenData = req.body?.audiotoolAuth ?? req.body?.authTokens ?? req.body?.tokens;

  if (tokenData !== undefined && tokenData !== null) {
    return readAudiotoolBrowserAuth(readJsonField(tokenData, 'audiotoolAuth'));
  }

  const headerValue = req.get('authorization') ?? '';
  const bearerToken = headerValue.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const bodyToken = stringifyOptional(req.body?.authToken ?? req.body?.pat);
  const token = bearerToken || bodyToken || audiotoolPat;

  if (!token) {
    throw new ClientError(
      'Audiotool auth is required. Sign in with Audiotool in the browser, set AUDIOTOOL_PAT, pass authToken/pat in JSON, or send an Authorization bearer token.',
      401
    );
  }

  return { pat: token };
}

function readAudiotoolBrowserAuth(tokenData: unknown): AudiotoolBrowserAuth {
  if (!tokenData || typeof tokenData !== 'object') {
    throw new ClientError('"audiotoolAuth" must be an object with accessToken, refreshToken, expiresAt, and clientId.');
  }

  const data = tokenData as Record<string, unknown>;
  const accessToken = stringifyOptional(data.accessToken)?.trim();
  const refreshToken = stringifyOptional(data.refreshToken)?.trim();
  const expiresAt = Number(data.expiresAt);
  const clientId = stringifyOptional(data.clientId ?? audiotoolClientId)?.trim();

  if (!accessToken || !refreshToken || !Number.isFinite(expiresAt) || !clientId) {
    throw new ClientError('"audiotoolAuth" must include accessToken, refreshToken, expiresAt, and clientId.');
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    clientId
  };
}

function readPositiveInteger(value: unknown, fallback: number, name: string): number {
  if (value === undefined) return fallback;

  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new ClientError(`"${name}" must be a positive integer.`);
  }

  return number;
}

function readAudiotoolOutputMode(value: unknown = 'combined'): AudiotoolOutputMode {
  const mode = stringifyOptional(value) ?? 'combined';
  const normalized = mode.toLowerCase();
  const aliases = new Map<string, AudiotoolOutputMode>([
    ['score', 'combined'],
    ['combined', 'combined'],
    ['parts', 'separate'],
    ['separate', 'separate'],
    ['both', 'both']
  ]);

  const outputMode = aliases.get(normalized);

  if (!outputMode) {
    throw new ClientError('Audiotool output mode must be "score", "combined", "parts", "separate", or "both".');
  }

  return outputMode;
}

function readTrackTitles(value: unknown): Record<string, string> {
  return readStringMap(value, 'trackTitles');
}

function readStringMap(value: unknown, name: string): Record<string, string> {
  const parsedValue = readJsonField(value, name);

  if (value === undefined || value === null) {
    return {};
  }

  if (!parsedValue || typeof parsedValue !== 'object' || Array.isArray(parsedValue)) {
    throw new ClientError(`"${name}" must be an object keyed by ID.`);
  }

  const titles: Record<string, string> = {};

  for (const [trackId, title] of Object.entries(parsedValue)) {
    const normalizedTrackId = trackId.trim();
    const normalizedTitle = stringifyOptional(title)?.trim();

    if (!normalizedTrackId) {
      throw new ClientError(`"${name}" cannot include an empty ID.`);
    }

    if (normalizedTitle) {
      titles[normalizedTrackId] = normalizedTitle;
    }
  }

  return titles;
}

function readTrackSelection(value: unknown): string[] | undefined {
  return readStringSelection(value);
}

function readStringSelection(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === 'all') {
    return undefined;
  }

  const parsedValue = readJsonField(value, 'selection');

  if (parsedValue === undefined || parsedValue === null || parsedValue === 'all') {
    return undefined;
  }

  if (Array.isArray(parsedValue)) {
    return parsedValue.map((item) => String(item));
  }

  if (typeof parsedValue === 'string' && parsedValue.trim().startsWith('[')) {
    throw new ClientError('"selection" must be an array, a comma-separated string, or omitted.');
  }

  if (Array.isArray(value)) {
    return value.map((track) => String(track));
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((track) => track.trim())
      .filter(Boolean);
  }

  throw new ClientError('"tracks" must be an array, a comma-separated string, or omitted.');
}

function readOptionalPositiveInteger(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null || value === '') return undefined;

  return readPositiveInteger(value, 0, name);
}

function readBooleanBody(value: unknown, fallback: boolean, name: string): boolean {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ClientError(`"${name}" must be true or false.`);
}

function stringifyOptional(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return String(value);
}

function readJsonField(value: unknown, name: string): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (!trimmed || !/^[{[]/.test(trimmed)) {
    return value;
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    throw new ClientError(`"${name}" must be valid JSON when sent as a string.`);
  }
}
