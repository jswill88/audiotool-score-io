import {
  allowedQuantizationGrids
} from '@midi-to-xml/midi-to-musicxml';
import { apiDefaultQuantizationGrid } from '../config/env.js';
import { ClientError } from '../errors/client-error.js';

export function queryValue(value, name) {
  if (Array.isArray(value)) {
    throw new ClientError(`Query parameter "${name}" must be supplied once.`);
  }

  return value;
}

export function parseBoolean(value, fallback, name) {
  if (value === undefined) return fallback;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new ClientError(`Query parameter "${name}" must be "true" or "false".`);
}

export function parseQuantizationEnabled({ preprocess, quantize }) {
  const preprocessEnabled = parseBoolean(preprocess, true, 'preprocess');
  const quantizeEnabled = parseBoolean(quantize, preprocessEnabled, 'quantize');

  if (preprocess !== undefined && quantize !== undefined && preprocessEnabled !== quantizeEnabled) {
    throw new ClientError('Query parameters "preprocess" and "quantize" conflict. Use one or set both to the same value.');
  }

  return quantizeEnabled;
}

export function parseQuantizationGrid(value) {
  const parsed = value === undefined ? apiDefaultQuantizationGrid : Number(value);

  if (!Number.isInteger(parsed) || !allowedQuantizationGrids.has(parsed)) {
    throw new ClientError('Query parameter "grid" must be one of 4, 8, 12, 16, 24, 32, 48, or 64.');
  }

  return parsed;
}
