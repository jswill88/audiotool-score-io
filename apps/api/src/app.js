import express from 'express';
import { convertRouter } from './routes/convert.js';
import { statusRouter } from './routes/status.js';
import { errorHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.use(statusRouter);
  app.use(convertRouter);
  app.use(errorHandler);

  return app;
}

export const app = createApp();
