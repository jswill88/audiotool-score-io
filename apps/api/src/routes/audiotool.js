import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import AdmZip from 'adm-zip';
import {
  createAudiotoolSession,
  exportAudiotoolProjectToMidi,
  getAudiotoolProjectDetails,
  inspectAudiotoolProjectReference,
  withAudiotoolProject
} from '@midi-to-xml/audiotool-to-midi';
import { convertMidiToMusicXml } from '@midi-to-xml/midi-to-musicxml';
import { Router } from 'express';
import {
  audiotoolClientId,
  audiotoolPat,
  conversionOptions,
  uploadDir
} from '../config/env.js';
import { ClientError } from '../errors/client-error.js';
import {
  parseQuantizationEnabled,
  parseQuantizationGrid,
  queryValue
} from '../utils/query.js';
import { sendError } from '../utils/responses.js';

export const audiotoolRouter = Router();

audiotoolRouter.post('/audiotool/projects', async (req, res) => {
  try {
    const client = await createRequestAudiotoolSession(req);
    const result = await client.projects.listProjects(readProjectListOptions(req));
    throwIfAudiotoolServiceError(result);
    const projects = Array.isArray(result) ? result : result.projects ?? [];

    res.json({
      projects: projects.map(serializeProject),
      nextPageToken: Array.isArray(result) ? '' : result.nextPageToken ?? ''
    });
  } catch (error) {
    sendError(res, error);
  }
});

audiotoolRouter.post('/audiotool/project', async (req, res) => {
  try {
    const client = await createRequestAudiotoolSession(req);
    const details = await getAudiotoolProjectDetails(client, readProjectReference(req));

    res.json({
      reference: details.reference,
      project: serializeProject(details.project)
    });
  } catch (error) {
    sendError(res, error);
  }
});

audiotoolRouter.get('/audiotool/project', async (req, res) => {
  try {
    const client = await createRequestAudiotoolSession(req);
    const details = await getAudiotoolProjectDetails(client, readProjectReference(req));

    res.json({
      reference: details.reference,
      project: serializeProject(details.project)
    });
  } catch (error) {
    sendError(res, error);
  }
});

audiotoolRouter.post('/audiotool/inspect', async (req, res) => {
  try {
    const client = await createRequestAudiotoolSession(req);
    const result = await inspectAudiotoolProjectReference(
      client,
      readProjectReference(req),
      readInspectOptions(req)
    );

    res.json({
      details: result.details
        ? {
            reference: result.details.reference,
            project: serializeProject(result.details.project)
          }
        : null,
      manifest: result.manifest
    });
  } catch (error) {
    sendError(res, error);
  }
});

audiotoolRouter.post('/audiotool/convert', async (req, res) => {
  const workDir = path.join(uploadDir, `audiotool-${Date.now()}-${randomUUID()}`);

  try {
    await fs.mkdir(workDir, { recursive: true });

    const client = await createRequestAudiotoolSession(req);
    const projectReference = readProjectReference(req);
    const options = readConversionRequestOptions(req);
    const details = await getAudiotoolProjectDetails(client, projectReference);
    const midiResult = await withAudiotoolProject(
      client,
      projectReference,
      (document) => exportAudiotoolProjectToMidi(document, {
        mode: options.mode,
        tracks: options.tracks,
        title: details.project?.displayName || 'Audiotool Export',
        includeDisabledTracks: options.includeDisabledTracks,
        includeDisabledRegions: options.includeDisabledRegions
      }),
      options
    );

    if (midiResult.exportedTracks.length === 0) {
      throw new ClientError('No enabled Audiotool note tracks matched the request.');
    }

    const musicXmlFiles = await convertMidiFilesToMusicXml({
      midiFiles: midiResult.files,
      workDir,
      quantize: options.quantize,
      grid: options.grid
    });

    if (musicXmlFiles.length === 1 && !options.includeMidi && !options.forceZip) {
      const file = musicXmlFiles[0];
      return res.download(file.path, file.name, async (err) => {
        await cleanupWorkDir(workDir);
        if (err && !res.headersSent) {
          sendError(res, err);
        }
      });
    }

    const archive = await createAudiotoolArchive({
      details,
      midiResult,
      musicXmlFiles,
      includeMidi: options.includeMidi
    });

    await cleanupWorkDir(workDir);
    res
      .status(200)
      .type('application/zip')
      .attachment(buildArchiveName(details.project))
      .send(archive);
  } catch (error) {
    await cleanupWorkDir(workDir);
    sendError(res, error);
  }
});

async function createRequestAudiotoolSession(req) {
  return createAudiotoolSession(readAudiotoolAuth(req));
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

function readProjectReference(req) {
  const project = req.body?.projectUrl ??
    req.body?.projectReference ??
    req.body?.project ??
    queryValue(req.query.project, 'project');

  if (!project || typeof project !== 'string') {
    throw new ClientError('Audiotool project URL, UUID, or projects/{id} reference is required.');
  }

  return project;
}

function readInspectOptions(req) {
  return {
    includeDetails: readBooleanBody(req.body?.includeDetails, true, 'includeDetails'),
    start: readBooleanBody(req.body?.start, true, 'start'),
    stop: readBooleanBody(req.body?.stop, true, 'stop')
  };
}

function readProjectListOptions(req) {
  return {
    pageSize: readPositiveInteger(req.body?.pageSize, 25, 'pageSize'),
    pageToken: stringifyOptional(req.body?.pageToken) ?? '',
    orderBy: stringifyOptional(req.body?.orderBy) ?? 'project.update_time desc',
    filter: stringifyOptional(req.body?.filter) ?? ''
  };
}

function readConversionRequestOptions(req) {
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

async function convertMidiFilesToMusicXml({
  midiFiles,
  workDir,
  quantize,
  grid
}) {
  const outputs = [];

  for (const midiFile of midiFiles) {
    const baseName = sanitizeFileBase(path.parse(midiFile.name).name || midiFile.kind);
    const inputPath = path.join(workDir, `${baseName}.mid`);
    const outputPath = path.join(workDir, `${baseName}.musicxml`);

    await fs.writeFile(inputPath, Buffer.from(midiFile.bytes));
    await convertMidiToMusicXml({
      inputPath,
      outputPath,
      quantize,
      grid,
      museScore: conversionOptions
    });

    outputs.push({
      kind: midiFile.kind,
      name: `${baseName}.musicxml`,
      path: outputPath,
      trackIds: midiFile.trackIds
    });
  }

  return outputs;
}

async function createAudiotoolArchive({
  details,
  midiResult,
  musicXmlFiles,
  includeMidi
}) {
  const zip = new AdmZip();
  const manifest = {
    project: serializeProject(details.project),
    reference: details.reference,
    tempo: midiResult.tempo,
    timeSignature: midiResult.timeSignature,
    tracks: midiResult.tracks,
    exportedTracks: midiResult.exportedTracks,
    warnings: midiResult.warnings,
    files: musicXmlFiles.map((file) => ({
      kind: file.kind,
      name: file.name,
      trackIds: file.trackIds
    }))
  };

  zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2)));

  for (const file of musicXmlFiles) {
    zip.addFile(`musicxml/${file.name}`, await fs.readFile(file.path));
  }

  if (includeMidi) {
    for (const file of midiResult.files) {
      zip.addFile(`midi/${sanitizeFileName(file.name)}`, Buffer.from(file.bytes));
    }
  }

  return zip.toBuffer();
}

function serializeProject(project) {
  if (!project) {
    return null;
  }

  if (typeof project.toJson === 'function') {
    return project.toJson();
  }

  return JSON.parse(JSON.stringify(project, (_key, value) => {
    return typeof value === 'bigint' ? value.toString() : value;
  }));
}

function throwIfAudiotoolServiceError(result) {
  if (!(result instanceof Error)) {
    return;
  }

  const message = result.cause?.message ?? result.message;
  const statusCode = message.includes('unauthenticated') ? 401 : 502;
  throw new ClientError(message, statusCode);
}

function buildArchiveName(project) {
  const projectName = sanitizeFileBase(project?.displayName || 'audiotool-export');
  return `${projectName}.zip`;
}

function sanitizeFileBase(value) {
  const sanitized = String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'audiotool-export';
}

function sanitizeFileName(value) {
  const parsed = path.parse(String(value));
  return `${sanitizeFileBase(parsed.name)}${parsed.ext.replace(/[^a-zA-Z0-9.]/g, '')}`;
}

function stringifyOptional(value) {
  if (value === undefined) return undefined;
  return String(value);
}

async function cleanupWorkDir(workDir) {
  await fs.rm(workDir, { recursive: true, force: true });
}
