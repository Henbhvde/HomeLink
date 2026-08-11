import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { requirePermission, requireRole, requireTenant } from './authorization.js';

const context = (auth: object) => {
  const res = { locals: { auth }, status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  return { req: {} as Request, res, next: vi.fn() as NextFunction };
};

describe('A01 access control middleware', () => {
  it('enforces roles and permissions', () => {
    const denied = context({ role: 'resident', tenantId: 't1' });
    requirePermission('manager-buildings')(denied.req, denied.res, denied.next);
    expect(denied.res.status).toHaveBeenCalledWith(403);
    expect(denied.next).not.toHaveBeenCalled();

    const allowed = context({ role: 'manager', tenantId: 't1' });
    requireRole('manager')(allowed.req, allowed.res, allowed.next);
    requirePermission('manager-buildings')(allowed.req, allowed.res, allowed.next);
    expect(allowed.next).toHaveBeenCalledTimes(2);
  });

  it('requires tenant context', () => {
    const value = context({ role: 'manager' });
    requireTenant(value.req, value.res, value.next);
    expect(value.res.status).toHaveBeenCalledWith(403);
  });
});
