import type { Prisma, PrismaClient } from '@prisma/client';

export type StatementRow = { date: string; amount: number; reference: string; description: string };
type Candidate = { id: string; number: string; outstanding: number };

const csvLine = (line: string) => { const cells: string[] = []; let value = '', quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { cells.push(value.trim()); value = ''; } else value += char; } cells.push(value.trim()); return cells; };

export function parseBankStatementCsv(csv: string): StatementRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) throw new Error('CSV must contain a header and at least one row.');
  const headers = csvLine(lines[0]).map((header) => header.toLowerCase());
  const required = ['date', 'amount', 'reference']; required.forEach((name) => { if (!headers.includes(name)) throw new Error(`Missing CSV column: ${name}.`); });
  return lines.slice(1).map((line, index) => {
    const values = csvLine(line); const get = (name: string) => values[headers.indexOf(name)]?.trim() ?? '';
    const date = get('date'); const amount = Number(get('amount').replace(/\s/g, ''));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(`${date}T00:00:00Z`).getTime())) throw new Error(`Invalid date at row ${index + 2}.`);
    if (!Number.isFinite(amount) || amount === 0) throw new Error(`Invalid amount at row ${index + 2}.`);
    if (!get('reference')) throw new Error(`Missing reference at row ${index + 2}.`);
    return { date, amount, reference: get('reference'), description: get('description') };
  });
}

export function selectReconciliationCandidate(row: StatementRow, candidates: Candidate[]) {
  if (row.amount < 0) return { status: 'unmatched' as const, reason: 'Debit transaction' };
  const text = `${row.reference} ${row.description}`.toLowerCase();
  const matches = candidates.filter((item) => text.includes(item.number.toLowerCase()) && Math.abs(item.outstanding - row.amount) < 0.01);
  return matches.length === 1 ? { status: 'matched' as const, invoiceId: matches[0].id } : matches.length > 1 ? { status: 'ambiguous' as const, candidateIds: matches.map((item) => item.id) } : { status: 'unmatched' as const, reason: 'No exact invoice number and amount match' };
}

export async function reconcileBankStatement(prisma: PrismaClient, tenantId: string, rows: StatementRow[]) {
  const invoices = await prisma.$queryRaw<Array<{ id: string; number: string; outstanding: Prisma.Decimal }>>`SELECT i."id",i."number",i."totalAmount"-COALESCE(SUM(pa."amount"),0) AS "outstanding" FROM "Invoice" i LEFT JOIN "PaymentAllocation" pa ON pa."invoiceId"=i."id" AND pa."tenantId"=${tenantId} WHERE i."tenantId"=${tenantId} AND i."status" IN (CAST('approved' AS "InvoiceStatus"),CAST('sent' AS "InvoiceStatus"),CAST('overdue' AS "InvoiceStatus")) GROUP BY i."id",i."number",i."totalAmount"`;
  const candidates = invoices.map((item) => ({ ...item, outstanding: Number(item.outstanding) }));
  return rows.map((row) => ({ ...row, reconciliation: selectReconciliationCandidate(row, candidates) }));
}
