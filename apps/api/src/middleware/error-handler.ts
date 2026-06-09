import multer from 'multer';
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  Response
} from 'express';
import { maxUploadBytes } from '../config/env.js';
import { ClientError } from '../errors/client-error.js';

type ErrorWithStatus = {
  statusCode?: unknown;
  message?: unknown;
};

export const errorHandler: ErrorRequestHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const error = err as ErrorWithStatus;
  const message = typeof error.message === 'string' ? error.message : 'Unexpected server error';

  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: `MIDI file exceeds the ${maxUploadBytes} byte upload limit.` });
  } else if (typeof error.statusCode === 'number') {
    res.status(error.statusCode).json({ error: message });
  } else if (err instanceof multer.MulterError || err instanceof ClientError || message.includes('MIDI')) {
    res.status(400).json({ error: message });
  } else {
    res.status(500).json({ error: message });
  }
};
