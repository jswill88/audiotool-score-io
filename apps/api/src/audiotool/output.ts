import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { convertMidiToMusicXml } from '@midi-to-xml/midi-to-musicxml';
import { uploadDir } from '../config/env.js';
import type {
  AudiotoolMidiFile,
  AudiotoolMidiResult,
  AudiotoolProjectDetails,
  MusicXmlFile,
  ProjectLike
} from '../types.js';

export async function createAudiotoolWorkDir() {
  const workDir = path.join(uploadDir, `audiotool-${Date.now()}-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  return workDir;
}

export async function convertMidiFilesToMusicXml({
  midiFiles,
  workDir,
  quantize,
  title,
  trackTitles
}: {
  midiFiles: AudiotoolMidiFile[];
  workDir: string;
  quantize: boolean;
  title: string;
  trackTitles?: Record<string, string>;
}): Promise<MusicXmlFile[]> {
  const outputs: MusicXmlFile[] = [];

  for (const midiFile of midiFiles) {
    const baseName = sanitizeFileBase(path.parse(midiFile.name).name || midiFile.kind);
    const inputPath = path.join(workDir, `${baseName}.mid`);
    const outputPath = path.join(workDir, `${baseName}.musicxml`);

    await fs.writeFile(inputPath, bytesToBuffer(midiFile.bytes));
    await convertMidiToMusicXml({
      inputPath,
      outputPath,
      quantize,
      title: midiFile.title || title,
      partNames: readPartNames(midiFile.trackIds, trackTitles)
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

export async function createAudiotoolArchive({
  details,
  midiResult,
  musicXmlFiles,
  includeMidi,
  title,
  trackTitles
}: {
  details: AudiotoolProjectDetails;
  midiResult: AudiotoolMidiResult;
  musicXmlFiles: MusicXmlFile[];
  includeMidi: boolean;
  title?: string;
  trackTitles?: Record<string, string>;
}) {
  const zip = new AdmZip();
  const manifest = {
    project: serializeProject(details.project),
    reference: details.reference,
    title,
    tempo: midiResult.tempo,
    timeSignature: midiResult.timeSignature,
    tracks: midiResult.tracks,
    exportedTracks: midiResult.exportedTracks,
    trackTitles,
    warnings: midiResult.warnings,
    files: musicXmlFiles.map((file: MusicXmlFile) => ({
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
      zip.addFile(`midi/${sanitizeFileName(file.name)}`, bytesToBuffer(file.bytes));
    }
  }

  return zip.toBuffer();
}

export function serializeProject(project: ProjectLike | null | undefined) {
  if (!project) {
    return null;
  }

  if (typeof project.toJson === 'function') {
    return project.toJson();
  }

  return JSON.parse(JSON.stringify(project, (_key: string, value: unknown) => {
    return typeof value === 'bigint' ? value.toString() : value;
  }));
}

export function buildArchiveName(project: ProjectLike | null | undefined) {
  const projectName = sanitizeFileBase(readProjectTitle(project));
  return `${projectName}.zip`;
}

export function readProjectTitle(project: ProjectLike | null | undefined) {
  const title = (
    project?.displayName ||
    project?.title ||
    (typeof project?.name === 'string' ? project.name.split('/').pop() : undefined) ||
    'Audiotool Export'
  );

  return String(title);
}

export async function cleanupWorkDir(workDir: string | undefined) {
  if (!workDir) return;
  await fs.rm(workDir, { recursive: true, force: true });
}

function sanitizeFileBase(value: unknown) {
  const sanitized = String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'audiotool-export';
}

function bytesToBuffer(bytes: AudiotoolMidiFile['bytes']) {
  return bytes instanceof ArrayBuffer ? Buffer.from(bytes) : Buffer.from(bytes);
}

function sanitizeFileName(value: unknown) {
  const parsed = path.parse(String(value));
  return `${sanitizeFileBase(parsed.name)}${parsed.ext.replace(/[^a-zA-Z0-9.]/g, '')}`;
}

function readPartNames(trackIds: string[] | undefined, trackTitles: Record<string, string> | undefined) {
  if (!trackIds || !trackTitles) {
    return undefined;
  }

  const partNames = trackIds.map((trackId) => trackTitles[trackId]?.trim() ?? '');

  return partNames.some(Boolean) ? partNames : undefined;
}
