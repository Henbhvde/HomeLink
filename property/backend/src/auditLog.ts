import { Prisma, type PrismaClient } from '@prisma/client';
import type { Request } from 'express';

const secretKeys = /password|token|secret|code|authorization/i;
export function sanitizeAuditMetadata(metadata: Record<string, unknown> = {}) {
  return Object.fromEntries(Object.entries(metadata).filter(([key]) => !secretKeys.test(key)));
}

export async function writeAudit(prisma: PrismaClient, req: Request, input: { tenantId: string; actorId?: string; action: string; entityType: string; entityId?: string; metadata?: Record<string, unknown> }) {
  try {
    const auth = (req as any).res?.locals?.auth;
    const enrichedMetadata = {
      ...input.metadata,
      ...(auth?.impersonatorSub ? { impersonatorId: auth.impersonatorSub, impersonatedBySuperAdmin: true } : {}),
    };
    const metadata = JSON.parse(JSON.stringify(sanitizeAuditMetadata(enrichedMetadata))) as Prisma.InputJsonObject;
    await prisma.auditLog.create({ data: { ...input, metadata, ipAddress: req.ip, userAgent: req.header('user-agent')?.slice(0, 500) } });
  } catch (error) { console.error('Audit log write failed:', error instanceof Error ? error.message : 'Unknown error'); }
}
