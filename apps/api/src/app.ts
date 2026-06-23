import express from 'express';
import { audiotoolRouter } from './routes/audiotool.js';
import { convertRouter } from './routes/convert.js';
import { statusRouter } from './routes/status.js';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/error-handler.js';
import { jsonBodyLimit } from './config/env.js';

export function createApp() {
  const app = express();

  app.use(corsMiddleware);
  app.use(express.json({ limit: jsonBodyLimit }));
  app.use(statusRouter);
  app.use(convertRouter);
  app.use(audiotoolRouter);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
