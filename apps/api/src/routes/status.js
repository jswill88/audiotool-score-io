import { Router } from 'express';
import { readMuseScoreStatus } from '@midi-to-xml/midi-to-musicxml';
import { conversionOptions } from '../config/env.js';

export const statusRouter = Router();

statusRouter.get('/health', (_req, res) => {
  res.send('ok');
});

statusRouter.get('/ready', async (_req, res) => {
  try {
    const status = await readMuseScoreStatus(conversionOptions);
    res.json({ status: 'ready', ...status });
  } catch (error) {
    res.status(503).json({ status: 'not_ready', error: error.message });
  }
});
