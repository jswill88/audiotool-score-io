import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { convertMidiToMusicXml } from '@midi-to-xml/midi-to-musicxml';
import {
  conversionOptions,
  uploadDir
} from '../config/env.js';

export async function createAudiotoolWorkDir() {
  const workDir = path.join(uploadDir, `audiotool-${Date.now()}-${randomUUID()}`);
  await fs.mkdir(workDir, { recursive: true });
  return workDir;
}

export async function convertMidiFilesToMusicXml({
  midiFiles,
  workDir,
  quantize,
  grid,
  title
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
      title: midiFile.title || title,
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

export async function createAudiotoolArchive({
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

export function serializeProject(project) {
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

export function buildArchiveName(project) {
  const projectName = sanitizeFileBase(readProjectTitle(project));
  return `${projectName}.zip`;
}

export function readProjectTitle(project) {
  return (
    project?.displayName ||
    project?.title ||
    project?.name?.split('/').pop() ||
    'Audiotool Export'
  );
}

export async function cleanupWorkDir(workDir) {
  if (!workDir) return;
  await fs.rm(workDir, { recursive: true, force: true });
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
