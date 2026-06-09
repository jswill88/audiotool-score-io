import {
  allowedQuantizationGrids
} from '@midi-to-xml/midi-to-musicxml';
import type { QuantizationGrid } from '@midi-to-xml/midi-to-musicxml';
import { apiDefaultQuantizationGrid } from '../config/env.js';
import { ClientError } from '../errors/client-error.js';

export function queryValue(value: unknown, name: string): string | undefined {
  if (Array.isArray(value)) {
    throw new ClientError(`Query parameter "${name}" must be supplied once.`);
  }

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ClientError(`Query parameter "${name}" must be a string.`);
  }

  return value;
}

export function parseBoolean(value: string | undefined, fallback: boolean, name: string) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ClientError(`Query parameter "${name}" must be "true" or "false".`);
}

export function parseQuantizationEnabled({
  preprocess,
  quantize
}: {
  preprocess?: string;
  quantize?: string;
}) {
  const preprocessEnabled = parseBoolean(preprocess, true, 'preprocess');
  const quantizeEnabled = parseBoolean(quantize, preprocessEnabled, 'quantize');

  if (preprocess !== undefined && quantize !== undefined && preprocessEnabled !== quantizeEnabled) {
    throw new ClientError('Query parameters "preprocess" and "quantize" conflict. Use one or set both to the same value.');
  }

  return quantizeEnabled;
}

export function parseQuantizationGrid(value?: string): QuantizationGrid {
  const parsed = value === undefined ? apiDefaultQuantizationGrid : Number(value);

  if (!Number.isInteger(parsed) || !allowedQuantizationGrids.has(parsed as QuantizationGrid)) {
    throw new ClientError('Query parameter "grid" must be one of 4, 8, 12, 16, 24, 32, 48, or 64.');
  }

  return parsed as QuantizationGrid;
}
