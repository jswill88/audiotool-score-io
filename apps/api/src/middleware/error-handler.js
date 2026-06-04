import multer from 'multer';
import { maxUploadBytes } from '../config/env.js';
import { ClientError } from '../errors/client-error.js';

export function errorHandler(err, _req, res, _next) {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: `MIDI file exceeds the ${maxUploadBytes} byte upload limit.` });
  } else if (err.statusCode) {
    res.status(err.statusCode).json({ error: err.message });
  } else if (err instanceof multer.MulterError || err instanceof ClientError || (err.message && err.message.includes('MIDI'))) {
    res.status(400).json({ error: err.message });
  } else {
    res.status(500).json({ error: err.message || 'Unexpected server error' });
  }
}
