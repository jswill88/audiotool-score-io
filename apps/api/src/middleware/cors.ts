import type { NextFunction, Request, Response } from 'express';
import { corsAllowedOrigins } from '../config/env.js';

const corsMethods = 'GET,POST,OPTIONS';
const corsHeaders = 'Content-Type, Authorization';
const exposedHeaders = 'Content-Disposition, Content-Type';

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('origin');
  const allowedOrigin = resolveAllowedOrigin(origin);

  if (allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', corsMethods);
    res.setHeader('Access-Control-Allow-Headers', corsHeaders);
    res.setHeader('Access-Control-Expose-Headers', exposedHeaders);
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS' && origin) {
    res.sendStatus(allowedOrigin ? 204 : 403);
    return;
  }

  next();
}

function resolveAllowedOrigin(origin: string | undefined) {
  if (!origin) {
    return null;
  }

  if (corsAllowedOrigins.includes('*')) {
    return '*';
  }

  return corsAllowedOrigins.includes(origin) ? origin : null;
}
