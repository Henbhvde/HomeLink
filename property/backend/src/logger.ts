import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler, Response } from 'express';
import { reportError } from './observability.js';

type AuthContext = { sub?: string; tenantId?: string };
export const logFields = (req: Request | undefined, res?: Response) => {
  const auth = res?.locals.auth as AuthContext | undefined;
  return { requestId: res?.locals.requestId, traceId: res?.locals.traceId, userId: auth?.sub, tenantId: auth?.tenantId, method: req?.method, path: req?.path };
};
export const logEvent = (level: 'info' | 'error', event: string, fields: Record<string, unknown> = {}) => console[level](JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields }));

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  res.locals.requestId = randomUUID(); res.locals.request = req;
  res.setHeader('X-Request-Id', res.locals.requestId);
  res.on('finish', () => logEvent('info', 'http.request', { ...logFields(req, res), status: res.statusCode, durationMs: Date.now() - startedAt }));
  next();
};

export function logError(error: unknown, req: Request | undefined, res: Response) {
  const errorId = randomUUID();
  const fields = { ...logFields(req, res), errorId, errorType: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : String(error) };
  logEvent('error', 'application.error', fields);
  reportError({ timestamp: new Date().toISOString(), event: 'application.error', ...fields });
  return errorId;
}
