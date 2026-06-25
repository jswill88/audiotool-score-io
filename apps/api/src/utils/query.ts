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

export function parseQuantizationEnabled(quantize?: string) {
  return parseBoolean(quantize, true, 'quantize');
}
