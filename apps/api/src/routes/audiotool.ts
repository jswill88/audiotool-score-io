import {
  exportAudiotoolProjectToDirectMusicXml,
  exportAudiotoolProjectToMidi,
  getAudiotoolProjectDetails,
  inspectAudiotoolProjectReference,
  withAudiotoolProject
} from '@midi-to-xml/audiotool-to-midi';
import type {
  AudiotoolDirectMusicXmlResult,
  AudiotoolMidiResult as PackageAudiotoolMidiResult
} from '@midi-to-xml/audiotool-to-midi';
import {
  buildScoreImportPlan,
  createAudiotoolProjectFromScore
} from '@midi-to-xml/score-to-audiotool';
import type {
  AudiotoolImportClient,
  ScoreImportPlan
} from '@midi-to-xml/score-to-audiotool';
import { Router, type Request, type Response } from 'express';
import {
  buildArchiveName,
  cleanupWorkDir,
  convertMidiFilesToMusicXml,
  createAudiotoolArchive,
  createAudiotoolWorkDir,
  readProjectTitle,
  serializeProject,
  writeDirectMusicXmlFiles
} from '../audiotool/output.js';
import {
  createRequestAudiotoolSession,
  readConversionRequestOptions,
  readInspectOptions,
  readProjectListOptions,
  readProjectReference,
  readScoreImportRequestOptions,
  throwIfAudiotoolServiceError
} from '../audiotool/request.js';
import { conversionOptions } from '../config/env.js';
import { ClientError } from '../errors/client-error.js';
import type { AudiotoolMidiResult } from '../types.js';
import { scoreUpload } from '../storage/upload.js';
import { cleanupFiles } from '../utils/files.js';
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

audiotoolRouter.post('/audiotool/project', handleProjectDetails);
audiotoolRouter.get('/audiotool/project', handleProjectDetails);

async function handleProjectDetails(req: Request, res: Response) {
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
}

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
    const projectTitle = options.title ?? readProjectTitle(details.project);
    const results = await withAudiotoolProject<{
      directResult: AudiotoolDirectMusicXmlResult | null;
      midiResult: PackageAudiotoolMidiResult;
    }>(
      client,
      projectReference,
      async (document: unknown) => {
        const exportOptions = {
          mode: options.mode,
          tracks: options.tracks,
          title: projectTitle,
          trackTitles: options.trackTitles,
          includeDisabledTracks: options.includeDisabledTracks,
          includeDisabledRegions: options.includeDisabledRegions,
          includeSkippedTracks: options.includeSkippedTracks
        };
        const midiResult = await exportAudiotoolProjectToMidi(document, exportOptions);
        const directResult = options.engine === 'ranked-direct'
          ? await exportAudiotoolProjectToDirectMusicXml(document, {
              ...exportOptions,
              quantize: options.quantize,
              grid: options.grid,
              rankNotation: options.quantize
            })
          : null;

        return { directResult, midiResult };
      },
      options
    );
    const midiResult: AudiotoolMidiResult = results.midiResult;

    if (midiResult.exportedTracks.length === 0) {
      throw new ClientError('No exportable Audiotool note tracks matched the request.');
    }

    const musicXmlFiles = results.directResult
      ? await writeDirectMusicXmlFiles({
          files: results.directResult.files,
          workDir
        })
      : await convertMidiFilesToMusicXml({
          midiFiles: midiResult.files,
          workDir,
          quantize: options.quantize,
          grid: options.grid,
          title: projectTitle,
          trackTitles: options.trackTitles
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
      engine: options.engine,
      midiResult,
      musicXmlFiles,
      includeMidi: options.includeMidi,
      title: projectTitle,
      trackTitles: options.trackTitles
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

audiotoolRouter.post('/audiotool/import', scoreUpload.single('file'), async (req, res) => {
  const sourcePath = req.file?.path;

  try {
    if (!req.file || !sourcePath) {
      throw new ClientError('MusicXML file is required under the "file" field.');
    }

    const options = readScoreImportRequestOptions(req);

    if (options.dryRun) {
      const plan = await buildScoreImportPlan({
        inputPath: sourcePath,
        sourceName: req.file.originalname,
        title: options.title,
        museScore: conversionOptions
      });

      return res.json({ plan: serializeScoreImportPlan(plan) });
    }

    const client = await createRequestAudiotoolSession(req);
    const result = await createAudiotoolProjectFromScore({
      client: client as unknown as AudiotoolImportClient,
      inputPath: sourcePath,
      sourceName: req.file.originalname,
      title: options.title,
      selectedPartIds: options.selectedPartIds,
      partTitles: options.partTitles,
      projectTemplateName: options.projectTemplateName,
      maxImportedNotes: options.maxImportedNotes,
      museScore: conversionOptions
    });

    res.json({
      project: serializeProject(result.project),
      dawUrl: result.dawUrl,
      plan: serializeScoreImportPlan(result.plan),
      importedParts: result.importedParts,
      warnings: result.warnings
    });
  } catch (error) {
    sendError(res, error);
  } finally {
    await cleanupFiles(sourcePath ? [sourcePath] : []);
  }
});

function serializeScoreImportPlan(plan: ScoreImportPlan) {
  return {
    ...plan,
    parts: plan.parts.map(({ notes: _notes, ...part }) => part)
  };
}
