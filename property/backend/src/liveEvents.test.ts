import { describe, expect, it } from 'vitest';
import { canReceiveLiveEvent } from './liveEvents.js';

const auth = { sub: 'u1', email: 'user@example.com', tenantId: 't1', role: 'manager' as const };
describe('live event isolation', () => {
  it('enforces tenant and optional user scope', () => {
    expect(canReceiveLiveEvent(auth, { type: 'payment.updated', tenantId: 't1', data: {} })).toBe(true);
    expect(canReceiveLiveEvent(auth, { type: 'notification.created', tenantId: 't1', userId: 'u2', data: {} })).toBe(false);
    expect(canReceiveLiveEvent(auth, { type: 'payment.updated', tenantId: 't2', data: {} })).toBe(false);
  });
});
