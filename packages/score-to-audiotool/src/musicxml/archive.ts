import fs from 'fs/promises';
import path from 'path';
import AdmZip from 'adm-zip';
import { ScoreImportValidationError } from '../errors.js';

export async function readMusicXml(
  inputPath: string,
  sourceName?: string
) {
  const extension = path.extname(sourceName || inputPath).toLowerCase();

  if (extension !== '.mxl') {
    return fs.readFile(inputPath, 'utf8');
  }

  try {
    const zip = new AdmZip(inputPath);
    const entries = zip.getEntries();
    const container = entries.find(
      (entry) => entry.entryName === 'META-INF/container.xml'
    );
    const containerXml = container?.getData().toString('utf8') ?? '';
    const rootPath = containerXml.match(
      /<rootfile\b[^>]*\bfull-path\s*=\s*["']([^"']+)["']/i
    )?.[1];
    const scoreEntry = (
      rootPath
        ? entries.find((entry) => entry.entryName === rootPath)
        : undefined
    ) ?? entries.find((entry) => (
      !entry.isDirectory &&
      !entry.entryName.startsWith('META-INF/') &&
      /\.(?:musicxml|xml)$/i.test(entry.entryName)
    ));

    if (!scoreEntry) {
      throw new Error('No MusicXML document was found in the archive.');
    }

    return scoreEntry.getData().toString('utf8');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new ScoreImportValidationError(
      `Unable to read compressed MusicXML: ${message}`
    );
  }
}
