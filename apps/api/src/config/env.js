import os from 'os';
import path from 'path';
import {
  defaultConversionTimeoutMs,
  defaultQuantizationGrid
} from '@midi-to-xml/midi-to-musicxml';

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const port = process.env.PORT ? Number(process.env.PORT) : 3000;
export const uploadDir = path.join(os.tmpdir(), 'midi-to-musicxml');
export const maxUploadBytes = parsePositiveInteger(process.env.MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
export const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
export const audiotoolPat = process.env.AUDIOTOOL_PAT || undefined;

export const conversionOptions = {
  conversionTimeoutMs: parsePositiveInteger(process.env.CONVERSION_TIMEOUT_MS, defaultConversionTimeoutMs),
  museScoreBin: process.env.MUSESCORE_BIN || undefined,
  virtualDisplayMode: process.env.MUSESCORE_USE_XVFB || 'auto',
  xvfbRunBin: process.env.XVFB_RUN_BIN || 'xvfb-run'
};

export const apiDefaultQuantizationGrid = parsePositiveInteger(
  process.env.DEFAULT_QUANTIZATION_GRID,
  defaultQuantizationGrid
);
