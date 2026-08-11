import { Prisma, type PrismaClient } from '@prisma/client';
import type { DataStore } from './dataStore.js';

const tenantsKey = 'platform-tenants';
const scopeKey = (scope: string) => `scope:${scope}`;

export class PrismaStore implements DataStore {
  constructor(private readonly prisma: PrismaClient) {}

  async initialize() { await this.prisma.$connect(); }

  private async get<T>(key: string) {
    const records = await this.prisma.$queryRaw<Array<{ value: Prisma.JsonValue }>>`
      SELECT "value" FROM "AppState" WHERE "key" = ${key} LIMIT 1
    `;
    return records[0]?.value as T | undefined;
  }

  private async set<T>(key: string, value: T) {
    const json = JSON.stringify(value);
    await this.prisma.$executeRaw`
      INSERT INTO "AppState" ("key", "value", "updatedAt") VALUES (${key}, CAST(${json} AS jsonb), NOW())
      ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value", "updatedAt" = NOW()
    `;
  }

  async getPlatformTenants<T>(seed: T): Promise<T> {
    const stored = await this.get<T>(tenantsKey);
    if (stored !== undefined) return stored;
    await this.set(tenantsKey, seed);
    return seed;
  }

  async setPlatformTenants<T>(value: T) { await this.set(tenantsKey, value); }
  async getScope<T>(scope: string) { return this.get<T>(scopeKey(scope)); }
  async setScope<T>(scope: string, value: T) { await this.set(scopeKey(scope), value); }
}
