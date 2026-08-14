import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { verifyAccessToken, type AuthTokenPayload } from './auth.js';
import type { PrismaClient } from '@prisma/client';

import { prisma } from './prisma.js';

type Role = AuthTokenPayload['role'];
export const defaultPermissions: Record<string, Role[]> = {
  'manager-buildings': ['manager'], 'manager-residents': ['manager'], 'meter-readings': ['accountant'],
  'billing-invoices': ['accountant'], 'billing-run': ['accountant'],
  'payment-statements': ['accountant'], 'payment-records': ['accountant'],
  'expense-records': ['accountant'], 'maintenance-requests': ['manager'], 'maintenance-announcements': ['manager'],
  'manager-settings': ['manager'], 'accountant-period': ['accountant'], 'staff-work-orders': ['staff'],
  'resident-portal-notices': ['resident'], 'resident-portal-tickets': ['resident'],
  'resident-service-tickets': ['resident'], 'resident-community-notices': ['resident'],
  'file-attachments': ['manager', 'accountant', 'staff', 'resident'],
  'report-export': ['manager', 'accountant'],
};

const deny = (res: Response, status: number, message: string) => res.status(status).json({ success: false, message, data: null });
const authFrom = (req: Request) => {
  const header = req.header('authorization');
  return header?.startsWith('Bearer ') ? verifyAccessToken(header.slice(7).trim()) : null;
};

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = authFrom(req);
  if (!auth) return deny(res, 401, 'A valid access token is required.');
  res.locals.auth = auth;
  next();
}

export const requireRole = (...roles: Role[]): RequestHandler => (_req, res, next) => {
  const auth = res.locals.auth as AuthTokenPayload | undefined;
  if (!auth || !roles.includes(auth.role)) return deny(res, 403, 'Required role is missing.');
  next();
};

export const requirePermission = (permission: string): RequestHandler => async (_req, res, next) => {
  const auth = res.locals.auth as AuthTokenPayload | undefined;
  if (!auth) return deny(res, 401, 'A valid access token is required.');

  try {
    if (auth.tenantId) {
      const stateKey = `${auth.tenantId}:custom-permissions`;
      const record = await prisma.appState.findUnique({ where: { key: stateKey } });
      if (record && record.value && typeof record.value === 'object') {
        const custom = record.value as Record<string, string[]>;
        const allowedRoles = custom[permission];
        if (allowedRoles && Array.isArray(allowedRoles)) {
          if (allowedRoles.includes(auth.role)) return next();
          return deny(res, 403, 'Required permission is missing.');
        }
      }
    }
  } catch {
    // Fail-safe: fall back to defaults
  }

  if (!defaultPermissions[permission]?.includes(auth.role)) return deny(res, 403, 'Required permission is missing.');
  next();
};

export const requireTenant: RequestHandler = (_req, res, next) => {
  const auth = res.locals.auth as AuthTokenPayload | undefined;
  if (!auth?.tenantId) return deny(res, 403, 'A tenant context is required.');
  next();
};

export const requireTenantStatus = (prisma: PrismaClient): RequestHandler => async (req, res, next) => {
  const auth = res.locals.auth as AuthTokenPayload | undefined;
  if (!auth?.tenantId) return deny(res, 403, 'A tenant context is required.');
  try {
    const rows = await prisma.$queryRaw<Array<{ status: string }>>`SELECT "status"::text AS "status" FROM "Tenant" WHERE "id"=${auth.tenantId}`;
    const status = rows[0]?.status;
    if (!status || status === 'pending' || status === 'rejected') return deny(res, 403, `Tenant access is ${status ?? 'unavailable'}.`);
    if ((status === 'read_only' || status === 'overdue') && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return deny(res, 403, `Tenant is ${status}; write access is disabled.`);
    res.locals.tenantStatus = status;
    next();
  } catch { return deny(res, 503, 'Tenant access could not be verified.'); }
};
