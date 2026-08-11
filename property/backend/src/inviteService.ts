import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { hashSensitiveToken } from './auth.js';

export const inviteExpiry = (now = Date.now()) => new Date(now + 7 * 24 * 60 * 60_000);
export const canResendInvite = (status: string) => status === 'pending' || status === 'expired';

export async function createInvite(prisma: PrismaClient, input: { tenantId: string; invitedById: string; email?: string; phone?: string; role: 'resident' | 'staff'; unitId?: string }) {
  if (input.unitId) {
    const unit = await prisma.unit.findFirst({ where: { id: input.unitId, tenantId: input.tenantId }, select: { id: true } });
    if (!unit) throw new Error('Unit not found in tenant.');
  }
  if (input.email) {
    const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() }, select: { id: true } });
    if (user) throw new Error('An account with this email already exists.');
    const duplicate = await prisma.invite.findFirst({ where: { tenantId: input.tenantId, email: input.email.toLowerCase(), status: 'pending', expiresAt: { gt: new Date() } }, select: { id: true } });
    if (duplicate) throw new Error('A pending invite already exists; resend it instead.');
  }
  const token = randomBytes(32).toString('base64url');
  const invite = await prisma.invite.create({ data: { ...input, email: input.email?.toLowerCase(), tokenHash: hashSensitiveToken(token), expiresAt: inviteExpiry() } });
  return { invite, token };
}

export async function resendInvite(prisma: PrismaClient, tenantId: string, id: string) {
  const current = await prisma.invite.findFirst({ where: { id, tenantId }, select: { id: true, status: true, email: true, phone: true, role: true } });
  if (!current) throw new Error('Invite not found.');
  if (!canResendInvite(current.status)) throw new Error('Invite cannot be resent.');
  const token = randomBytes(32).toString('base64url');
  const invite = await prisma.invite.update({ where: { id }, data: { tokenHash: hashSensitiveToken(token), status: 'pending', expiresAt: inviteExpiry() } });
  return { invite, token };
}

export async function revokeInvite(prisma: PrismaClient, tenantId: string, id: string) {
  const result = await prisma.invite.updateMany({ where: { id, tenantId, status: 'pending' }, data: { status: 'revoked' } });
  if (!result.count) throw new Error('Pending invite not found.');
}

export const expireInvites = (prisma: PrismaClient, tenantId: string) => prisma.invite.updateMany({ where: { tenantId, status: 'pending', expiresAt: { lte: new Date() } }, data: { status: 'expired' } });
