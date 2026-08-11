import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { ensureRedisConnection, redis } from './redis.js';
import { PrismaStore } from './prismaStore.js';

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.replace('localhost', '127.0.0.1') : undefined,
    },
  },
});

describe('Database and Redis Integration Tests', () => {
  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await testPrisma.$connect();
      await ensureRedisConnection();
      isDbAvailable = true;
    } catch {
      console.warn('⚠️ Postgres or Redis is not reachable. Skipping integration tests.');
    }
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await testPrisma.$executeRaw`DELETE FROM "AppState" WHERE "key" LIKE 'test:%' OR "key" = 'platform-tenants-test'`;
      if (redis.isOpen) {
        await redis.del('test:key');
        await redis.disconnect();
      }
      await testPrisma.$disconnect();
    }
  });

  it('should successfully read and write to Postgres using PrismaStore', async ({ skip }) => {
    if (!isDbAvailable) skip();
    const store = new PrismaStore(testPrisma);
    await store.setScope('test:scope', { status: 'ok' });
    const val = await store.getScope<{ status: string }>('test:scope');
    expect(val).toEqual({ status: 'ok' });
  });

  it('should successfully read and write key-value pairs in Redis', async ({ skip }) => {
    if (!isDbAvailable) skip();
    await redis.set('test:key', 'integration-value', { EX: 10 });
    const val = await redis.get('test:key');
    expect(val).toBe('integration-value');
  });
});
