import { describe, expect, it } from 'vitest';
import { paymentFingerprint } from './transactionService.js';

describe('duplicate-safe payment design', () => {
  const base = { reference: 'BANK-1', method: 'bank', amount: 100, allocations: [{ invoiceId: 'b', amount: 40 }, { invoiceId: 'a', amount: 60 }] };
  it('creates a stable fingerprint and detects changed details', () => {
    expect(paymentFingerprint(base)).toBe(paymentFingerprint({ ...base, allocations: [...base.allocations].reverse() }));
    expect(paymentFingerprint(base)).not.toBe(paymentFingerprint({ ...base, amount: 101 }));
  });
});
