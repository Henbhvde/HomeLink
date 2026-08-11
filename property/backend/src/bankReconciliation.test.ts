import { describe, expect, it } from 'vitest';
import { parseBankStatementCsv, selectReconciliationCandidate } from './bankReconciliation.js';

describe('bank statement reconciliation', () => {
  it('parses quoted CSV and matches exact invoice number plus amount', () => {
    const [row] = parseBankStatementCsv('date,amount,reference,description\n2026-08-02,12500,INV-10,"Unit, payment"');
    expect(selectReconciliationCandidate(row, [{ id: 'i1', number: 'INV-10', outstanding: 12500 }])).toEqual({ status: 'matched', invoiceId: 'i1' });
  });
  it('marks multiple matches as ambiguous', () => {
    const row = { date: '2026-08-02', amount: 100, reference: 'INV', description: '' };
    expect(selectReconciliationCandidate(row, [{ id: '1', number: 'INV', outstanding: 100 }, { id: '2', number: 'INV', outstanding: 100 }]).status).toBe('ambiguous');
  });
});
