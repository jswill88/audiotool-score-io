import {
  exportAudiotoolProjectToMidi,
  getAudiotoolProjectDetails,
  inspectAudiotoolProjectReference,
  withAudiotoolProject
} from '@midi-to-xml/audiotool-to-midi';
import { Router } from 'express';
import {
  buildArchiveName,
  cleanupWorkDir,
  convertMidiFilesToMusicXml,
  createAudiotoolArchive,
  createAudiotoolWorkDir,
  readProjectTitle,
  serializeProject
} from '../audiotool/output.js';
import {
  createRequestAudiotoolSession,
  readConversionRequestOptions,
  readInspectOptions,
  readProjectListOptions,
  readProjectReference,
  throwIfAudiotoolServiceError
} from '../audiotool/request.js';
import { ClientError } from '../errors/client-error.js';
import type { AudiotoolMidiResult } from '../types.js';
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
  let workDir: string | undefined;

  try {
    workDir = await createAudiotoolWorkDir();

    const client = await createRequestAudiotoolSession(req);
    const projectReference = readProjectReference(req);
    const options = readConversionRequestOptions(req);
    const details = await getAudiotoolProjectDetails(client, projectReference);
    const projectTitle = readProjectTitle(details.project);
    const midiResult = await withAudiotoolProject<AudiotoolMidiResult>(
      client,
      projectReference,
      (document: unknown) => exportAudiotoolProjectToMidi(document, {
        mode: options.mode,
        tracks: options.tracks,
        title: projectTitle,
        includeDisabledTracks: options.includeDisabledTracks,
        includeDisabledRegions: options.includeDisabledRegions,
        includeSkippedTracks: options.includeSkippedTracks
      }),
      options
    );

    if (midiResult.exportedTracks.length === 0) {
      throw new ClientError('No exportable Audiotool note tracks matched the request.');
    }

    const musicXmlFiles = await convertMidiFilesToMusicXml({
      midiFiles: midiResult.files,
      workDir,
      quantize: options.quantize,
      grid: options.grid,
      title: projectTitle
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
