import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { verifyAccessToken, createAccessToken } from './auth.js';
import { belongsToTenant } from './tenantEntity.js';
import { allocatePayment } from './transactionService.js';
import jwt from 'jsonwebtoken';

const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.POSTGRES_URL ? process.env.POSTGRES_URL.replace('localhost', '127.0.0.1') : undefined,
    },
  },
});

describe('E2E API Tests (Tenant Isolation, Auth Expiry, Payment Idempotency)', () => {
  let isDbAvailable = false;

  beforeAll(async () => {
    try {
      await testPrisma.$connect();
      isDbAvailable = true;
    } catch {
      console.warn('⚠️ Postgres is not reachable. Skipping database-dependent E2E tests.');
    }
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await testPrisma.$executeRaw`DELETE FROM "PaymentAllocation" WHERE "tenantId" = 'test-e2e-tenant'`;
      await testPrisma.$executeRaw`DELETE FROM "Payment" WHERE "tenantId" = 'test-e2e-tenant'`;
      await testPrisma.$disconnect();
    }
  });

  describe('Tenant Isolation', () => {
    it('belongsToTenant should correctly isolate entities by tenantId', () => {
      const entity = { id: 'entity-1', tenantId: 'tenant-A', data: 'secret' };
      
      // Belongs to tenant-A
      expect(belongsToTenant(entity, 'tenant-A', 'entity-1')).toBe(true);
      
      // Does not belong to tenant-B
      expect(belongsToTenant(entity, 'tenant-B', 'entity-1')).toBe(false);
      
      // Wrong ID
      expect(belongsToTenant(entity, 'tenant-A', 'entity-2')).toBe(false);
    });
  });

  describe('Auth Expiry', () => {
    it('should verify active tokens and reject expired ones', () => {
      process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters';
      
      // Active token
      const token = createAccessToken({ sub: 'user-1', email: 'user@example.com', role: 'resident', tenantId: 'tenant-1' });
      const payload = verifyAccessToken(token);
      expect(payload).not.toBeNull();
      expect(payload?.sub).toBe('user-1');

      // Expired token manually signed
      const expiredToken = jwt.sign(
        { sub: 'user-1', email: 'user@example.com', role: 'resident', tenantId: 'tenant-1' },
        process.env.JWT_SECRET,
        { expiresIn: -10, issuer: 'homelink-api', audience: 'homelink-web' }
      );
      const expiredPayload = verifyAccessToken(expiredToken);
      expect(expiredPayload).toBeNull();
    });
  });

  describe('Payment Idempotency', () => {
    it('should handle duplicate payment requests idempotently', async ({ skip }) => {
      if (!isDbAvailable) skip();

      const paymentInput = {
        reference: 'REF-IDEMPOTENT-123',
        method: 'bank_transfer',
        amount: 150000,
        paidAt: new Date().toISOString(),
        allocations: [],
      };

      // First call - creates the payment
      const paymentId1 = await allocatePayment(testPrisma, 'test-e2e-tenant', paymentInput);
      expect(paymentId1).toBeDefined();

      // Second call (identical details) - should return the same payment ID (idempotency)
      const paymentId2 = await allocatePayment(testPrisma, 'test-e2e-tenant', paymentInput);
      expect(paymentId2).toBe(paymentId1);

      // Third call (same reference, different details) - should throw an error
      const modifiedInput = { ...paymentInput, amount: 200000 };
      await expect(
        allocatePayment(testPrisma, 'test-e2e-tenant', modifiedInput)
      ).rejects.toThrow('Payment reference is already used with different details.');
    });
  });
});
