import os from 'os';
import path from 'path';

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

export const port = process.env.PORT ? Number(process.env.PORT) : 3000;
export const uploadDir = path.join(os.tmpdir(), 'midi-to-musicxml');
export const maxUploadBytes = parsePositiveInteger(process.env.MAX_UPLOAD_BYTES, 50 * 1024 * 1024);
export const jsonBodyLimit = process.env.JSON_BODY_LIMIT || '1mb';
export const audiotoolPat = process.env.AUDIOTOOL_PAT || undefined;
export const audiotoolClientId = process.env.AUDIOTOOL_CLIENT_ID || undefined;
export const corsAllowedOrigins = parseStringList(
  process.env.CORS_ORIGINS || process.env.CORS_ORIGIN
);
