import { Router } from 'express';

export const statusRouter = Router();

statusRouter.get('/health', (_req, res) => {
  res.send('ok');
});

statusRouter.get('/ready', (_req, res) => {
  res.json({ status: 'ready', converter: 'direct' });
});
