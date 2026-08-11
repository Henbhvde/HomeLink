import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';

export const refreshCookieName = 'homelink_refresh';
export const refreshTtlSeconds = 30 * 24 * 60 * 60;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const newToken = () => randomBytes(48).toString('base64url');

export function refreshCookie(token: string, clear = false) {
  return `${refreshCookieName}=${clear ? '' : token}; HttpOnly; Path=/api/v1/auth; SameSite=Lax; Max-Age=${clear ? 0 : refreshTtlSeconds}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export function readRefreshCookie(header?: string) {
  return header?.split(';').map((item) => item.trim()).find((item) => item.startsWith(`${refreshCookieName}=`))?.slice(refreshCookieName.length + 1) || null;
}

export async function issueRefreshToken(prisma: PrismaClient, user: { id: string; tenantId: string | null }, familyId = randomUUID()) {
  const token = newToken();
  await prisma.$executeRaw`INSERT INTO "RefreshToken" ("id","tenantId","userId","familyId","tokenHash","expiresAt","createdAt") VALUES (${randomUUID()},${user.tenantId ?? 'platform'},${user.id},${familyId},${hash(token)},${new Date(Date.now() + refreshTtlSeconds * 1000)},NOW())`;
  return token;
}

export async function rotateRefreshToken(prisma: PrismaClient, rawToken: string) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string; userId: string; familyId: string; expiresAt: Date; revokedAt: Date | null }>>`SELECT "id","userId","familyId","expiresAt","revokedAt" FROM "RefreshToken" WHERE "tokenHash"=${hash(rawToken)} FOR UPDATE`;
    const current = rows[0];
    if (!current) return null;
    if (current.revokedAt || current.expiresAt <= new Date()) {
      await tx.$executeRaw`UPDATE "RefreshToken" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE "familyId"=${current.familyId}`;
      return null;
    }
    const token = newToken();
    const tokenHash = hash(token);
    await tx.$executeRaw`UPDATE "RefreshToken" SET "revokedAt"=NOW(),"replacedBy"=${tokenHash} WHERE "id"=${current.id}`;
    await tx.$executeRaw`INSERT INTO "RefreshToken" ("id","tenantId","userId","familyId","tokenHash","expiresAt","createdAt") SELECT ${randomUUID()},"tenantId","userId","familyId",${tokenHash},${new Date(Date.now() + refreshTtlSeconds * 1000)},NOW() FROM "RefreshToken" WHERE "id"=${current.id}`;
    return { token, userId: current.userId };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function revokeRefreshToken(prisma: PrismaClient, rawToken: string) {
  await prisma.$executeRaw`UPDATE "RefreshToken" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE "tokenHash"=${hash(rawToken)}`;
}

export async function listSessions(prisma: PrismaClient, userId: string) {
  return prisma.$queryRaw<Array<{ id: string; createdAt: Date; expiresAt: Date }>>`SELECT "familyId" AS "id", MAX("createdAt") AS "createdAt", MAX("expiresAt") AS "expiresAt" FROM "RefreshToken" WHERE "userId"=${userId} AND "revokedAt" IS NULL AND "expiresAt">NOW() GROUP BY "familyId" ORDER BY MAX("createdAt") DESC`;
}

export async function revokeSession(prisma: PrismaClient, userId: string, familyId: string) {
  return prisma.$executeRaw`UPDATE "RefreshToken" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE "userId"=${userId} AND "familyId"=${familyId}`;
}

export async function revokeAllSessions(prisma: PrismaClient, userId: string) {
  return prisma.$executeRaw`UPDATE "RefreshToken" SET "revokedAt"=COALESCE("revokedAt",NOW()) WHERE "userId"=${userId} AND "revokedAt" IS NULL`;
}
