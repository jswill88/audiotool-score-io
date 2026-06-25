import path from 'path';
import { ScoreImportValidationError } from './errors.js';
import { buildScoreImportPlanFromMusicXml } from './musicxml/index.js';
import type {
  BuildScoreImportPlanOptions,
  ScoreImportPlan
} from './types.js';

const scoreExtensions = new Set(['.musicxml', '.xml', '.mxl']);

export async function buildScoreImportPlan({
  inputPath,
  sourceName,
  title
}: BuildScoreImportPlanOptions): Promise<ScoreImportPlan> {
  assertScoreInputPath(inputPath, sourceName);
  return buildScoreImportPlanFromMusicXml({
    inputPath,
    sourceName: sourceName ?? path.basename(inputPath),
    title
  });
}

function assertScoreInputPath(inputPath: string, sourceName?: string) {
  if (!inputPath) {
    throw new ScoreImportValidationError('inputPath is required.');
  }

  const extension = path.extname(sourceName || inputPath).toLowerCase();

  if (!scoreExtensions.has(extension)) {
    throw new ScoreImportValidationError('Score import requires a .musicxml, .xml, or .mxl file.');
  }
}
