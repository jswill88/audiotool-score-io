import os from 'os';
import path from 'path';
import {
  allowedVirtualDisplayModes,
  defaultConversionTimeoutMs,
  defaultQuantizationGrid
} from '@midi-to-xml/midi-to-musicxml';
import type {
  MuseScoreOptions,
  VirtualDisplayMode
} from '@midi-to-xml/midi-to-musicxml';

function parsePositiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStringList(value: string | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseVirtualDisplayMode(value: string | undefined): VirtualDisplayMode {
  const mode = (value || 'auto').toLowerCase();

  if (!allowedVirtualDisplayModes.has(mode as VirtualDisplayMode)) {
    throw new Error('MUSESCORE_USE_XVFB must be "auto", "always", or "never".');
  }

  return mode as VirtualDisplayMode;
}

export const port = process.env.PORT ? Number(process.env.PORT) : 3000;
export const uploadDir = path.join(os.tmpdir(), 'midi-to-musicxml');
export const maxUploadBytes = parsePositiveInteger(process.env.MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
export const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
export const audiotoolPat = process.env.AUDIOTOOL_PAT || undefined;
export const audiotoolClientId = process.env.AUDIOTOOL_CLIENT_ID || undefined;
export const corsAllowedOrigins = parseStringList(
  process.env.CORS_ORIGINS || process.env.CORS_ORIGIN
);

export const conversionOptions: MuseScoreOptions = {
  conversionTimeoutMs: parsePositiveInteger(process.env.CONVERSION_TIMEOUT_MS, defaultConversionTimeoutMs),
  museScoreBin: process.env.MUSESCORE_BIN || undefined,
  virtualDisplayMode: parseVirtualDisplayMode(process.env.MUSESCORE_USE_XVFB),
  xvfbRunBin: process.env.XVFB_RUN_BIN || 'xvfb-run'
};

export const apiDefaultQuantizationGrid = parsePositiveInteger(
  process.env.DEFAULT_QUANTIZATION_GRID,
  defaultQuantizationGrid
);
