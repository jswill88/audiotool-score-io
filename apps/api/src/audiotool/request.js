import { createAudiotoolSession } from '@midi-to-xml/audiotool-to-midi';
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

export async function createRequestAudiotoolSession(req) {
  return createAudiotoolSession(readAudiotoolAuth(req));
}

export function readProjectReference(req) {
  const project = req.body?.projectUrl ??
    req.body?.projectReference ??
    req.body?.project ??
    queryValue(req.query.project, 'project');

  if (!project || typeof project !== 'string') {
    throw new ClientError('Audiotool project URL, UUID, or projects/{id} reference is required.');
  }

  return project;
}

export function readInspectOptions(req) {
  return {
    includeDetails: readBooleanBody(req.body?.includeDetails, true, 'includeDetails'),
    start: readBooleanBody(req.body?.start, true, 'start'),
    stop: readBooleanBody(req.body?.stop, true, 'stop')
  };
}

export function readProjectListOptions(req) {
  return {
    pageSize: readPositiveInteger(req.body?.pageSize, 25, 'pageSize'),
    pageToken: stringifyOptional(req.body?.pageToken) ?? '',
    orderBy: stringifyOptional(req.body?.orderBy) ?? 'project.update_time desc',
    filter: stringifyOptional(req.body?.filter) ?? ''
  };
}

export function readConversionRequestOptions(req) {
  return {
    mode: readAudiotoolOutputMode(req.body?.mode ?? req.body?.outputMode ?? req.query.mode),
    tracks: readTrackSelection(req.body?.tracks ?? req.body?.trackIds),
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

export function throwIfAudiotoolServiceError(result) {
  if (!(result instanceof Error)) {
    return;
  }

  const message = result.cause?.message ?? result.message;
  const statusCode = message.includes('unauthenticated') ? 401 : 502;
  throw new ClientError(message, statusCode);
}

function readAudiotoolAuth(req) {
  const tokenData = req.body?.audiotoolAuth ?? req.body?.authTokens ?? req.body?.tokens;

  if (tokenData !== undefined && tokenData !== null) {
    return readAudiotoolBrowserAuth(tokenData);
  }

  const headerValue = req.get('authorization') ?? '';
  const bearerToken = headerValue.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  const bodyToken = req.body?.authToken ?? req.body?.pat;
  const token = bearerToken || bodyToken || audiotoolPat;

  if (!token) {
    throw new ClientError(
      'Audiotool auth is required. Sign in with Audiotool in the browser, set AUDIOTOOL_PAT, pass authToken/pat in JSON, or send an Authorization bearer token.',
      401
    );
  }

  return { pat: token };
}

function readAudiotoolBrowserAuth(tokenData) {
  if (typeof tokenData !== 'object') {
    throw new ClientError('"audiotoolAuth" must be an object with accessToken, refreshToken, expiresAt, and clientId.');
  }

  const accessToken = stringifyOptional(tokenData.accessToken)?.trim();
  const refreshToken = stringifyOptional(tokenData.refreshToken)?.trim();
  const expiresAt = Number(tokenData.expiresAt);
  const clientId = stringifyOptional(tokenData.clientId ?? audiotoolClientId)?.trim();

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

function readPositiveInteger(value, fallback, name) {
  if (value === undefined) return fallback;

  const number = Number(value);

  if (!Number.isInteger(number) || number <= 0) {
    throw new ClientError(`"${name}" must be a positive integer.`);
  }

  return number;
}

function readAudiotoolOutputMode(value = 'combined') {
  const mode = stringifyOptional(value) ?? 'combined';
  const normalized = mode.toLowerCase();
  const aliases = new Map([
    ['score', 'combined'],
    ['combined', 'combined'],
    ['parts', 'separate'],
    ['separate', 'separate'],
    ['both', 'both']
  ]);

  if (!aliases.has(normalized)) {
    throw new ClientError('Audiotool output mode must be "score", "combined", "parts", "separate", or "both".');
  }

  return aliases.get(normalized);
}

function readTrackSelection(value) {
  if (value === undefined || value === null || value === 'all') {
    return undefined;
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

function readBooleanBody(value, fallback, name) {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ClientError(`"${name}" must be true or false.`);
}

function stringifyOptional(value) {
  if (value === undefined) return undefined;
  return String(value);
}
