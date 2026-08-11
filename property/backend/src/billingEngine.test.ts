import { describe, expect, it } from 'vitest';
import { canTransitionInvoice } from './transactionService.js';

describe('invoice lifecycle', () => {
  it('enforces draft, approve, send and void transitions', () => {
    expect(canTransitionInvoice('draft', 'approve')).toBe(true);
    expect(canTransitionInvoice('approved', 'send')).toBe(true);
    expect(canTransitionInvoice('paid', 'void')).toBe(false);
    expect(canTransitionInvoice('sent', 'approve')).toBe(false);
  });
});
