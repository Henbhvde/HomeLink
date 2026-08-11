import { describe, expect, it } from 'vitest';
import { shouldMarkOverdue } from './backgroundJobs.js';

describe('background jobs', () => {
  it('marks only sent invoices past due', () => {
    const now = new Date('2026-08-02T00:00:00Z');
    expect(shouldMarkOverdue('sent', new Date('2026-08-01T00:00:00Z'), now)).toBe(true);
    expect(shouldMarkOverdue('paid', new Date('2026-08-01T00:00:00Z'), now)).toBe(false);
    expect(shouldMarkOverdue('sent', new Date('2026-08-03T00:00:00Z'), now)).toBe(false);
  });
});
