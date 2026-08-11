import { describe, expect, it } from 'vitest';
import { approveRequestSchema, googleStartQuerySchema, idParamsSchema, invoiceGenerationSchema, notificationQueueSchema, paginationQuerySchema, parseBody, statePayloadSchema, subscriptionSchema, tenantListQuerySchema } from './validation.js';

describe('API body validation', () => {
  it('validates params and query independently', () => {
    expect(idParamsSchema.safeParse({ id: 'tenant-1' }).success).toBe(true);
    expect(idParamsSchema.safeParse({ id: '', extra: 'x' }).success).toBe(false);
    expect(googleStartQuerySchema.safeParse({ redirectUri: 'https://app.test/auth/callback' }).success).toBe(true);
    expect(tenantListQuerySchema.safeParse({ status: 'unknown' }).success).toBe(false);
    expect(paginationQuerySchema.parse({ page: '2', limit: '25', sortBy: 'createdAt', sortOrder: 'desc' })).toMatchObject({ page: 2, limit: 25 });
    expect(paginationQuerySchema.safeParse({ limit: '101', sortBy: 'bad-field!' }).success).toBe(false);
  });
  it('accepts supported plans', () => {
    expect(parseBody(approveRequestSchema, { plan: 'Growth' })).toEqual({ data: { plan: 'Growth' } });
  });

  it('rejects unsupported plans and unknown fields', () => {
    expect('error' in parseBody(approveRequestSchema, { plan: 'Premium' })).toBe(true);
    expect('error' in parseBody(approveRequestSchema, { plan: 'Start', role: 'super_admin' })).toBe(true);
  });

  it('requires a subscription change and validates calendar dates', () => {
    expect('error' in parseBody(subscriptionSchema, {})).toBe(true);
    expect('error' in parseBody(subscriptionSchema, { trialEndsAt: '2026-02-30' })).toBe(true);
    expect(parseBody(subscriptionSchema, { trialEndsAt: '2026-08-11' })).toEqual({ data: { trialEndsAt: '2026-08-11' } });
  });

  it('accepts falsy state values but requires the data property', () => {
    expect(parseBody(statePayloadSchema, { data: false })).toEqual({ data: { data: false } });
    expect('error' in parseBody(statePayloadSchema, {})).toBe(true);
  });

  it('allows invoice generation without manual lines', () => {
    expect(parseBody(invoiceGenerationSchema, {
      periodStart: '2026-08-01T00:00:00.000Z',
      periodEnd: '2026-08-31T23:59:59.000Z',
      dueAt: '2026-09-10T00:00:00.000Z',
      penaltyRate: 0.01,
      invoices: [{ unitId: 'unit-1' }]
    })).toEqual({
      data: {
        periodStart: '2026-08-01T00:00:00.000Z',
        periodEnd: '2026-08-31T23:59:59.000Z',
        dueAt: '2026-09-10T00:00:00.000Z',
        includeAreaCharges: true,
        includeMeterCharges: true,
        includeOutstanding: true,
        penaltyRate: 0.01,
        penaltyGraceDays: 0,
        invoices: [{ unitId: 'unit-1' }]
      }
    });
  });

  describe('notificationQueueSchema', () => {
    it('accepts template keys and variables without title or body', () => {
      const parsed = parseBody(notificationQueueSchema, {
        userId: 'user-1',
        channels: ['in_app', 'email'],
        templateKey: 'payment_received',
        variables: { amount: '25,000', reference: 'QPay-1002' },
        lang: 'mn'
      });
      expect(parsed).toEqual({
        data: {
          userId: 'user-1',
          channels: ['in_app', 'email'],
          templateKey: 'payment_received',
          variables: { amount: '25,000', reference: 'QPay-1002' },
          lang: 'mn'
        }
      });
    });

    it('accepts custom title and body without templateKey', () => {
      const parsed = parseBody(notificationQueueSchema, {
        userId: 'user-1',
        channels: ['in_app'],
        title: 'Custom Alert',
        body: 'Custom notification body'
      });
      expect(parsed).toEqual({
        data: {
          userId: 'user-1',
          channels: ['in_app'],
          title: 'Custom Alert',
          body: 'Custom notification body'
        }
      });
    });

    it('rejects if neither templateKey nor custom title and body are provided', () => {
      const parsed = parseBody(notificationQueueSchema, {
        userId: 'user-1',
        channels: ['in_app']
      });
      expect('error' in parsed).toBe(true);
    });
  });
});
