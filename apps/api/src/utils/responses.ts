import type { Response } from 'express';

type ErrorResponse = {
  statusCode?: unknown;
  message?: unknown;
};

export function sendError(res: Response, error: unknown) {
  const errorResponse = error as ErrorResponse;
  const statusCode = typeof errorResponse.statusCode === 'number' ? errorResponse.statusCode : 500;
  const message = typeof errorResponse.message === 'string'
    ? errorResponse.message
    : 'Unexpected server error';

  res.status(statusCode).json({ error: message });
}
