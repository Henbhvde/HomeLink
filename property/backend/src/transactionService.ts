import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { z } from 'zod';
import type { invoiceGenerationSchema, paymentAllocationSchema, residentImportSchema } from './validation.js';

type InvoiceInput = z.input<typeof invoiceGenerationSchema>;
type PaymentInput = z.infer<typeof paymentAllocationSchema>;
type ResidentImportInput = z.infer<typeof residentImportSchema>;
const options = { isolationLevel: Prisma.TransactionIsolationLevel.Serializable } as const;
type InvoiceLineDraft = { tariffId?: string; description: string; quantity: number; unitPrice: number };
type UnitForInvoice = { id: string; number: string; areaSqm: number | null; residentProfileId: string | null };
type TariffRow = { id: string; name: string; serviceCode: string; billingUnit: string; unitPrice: Prisma.Decimal };

const toMoney = (value: number) => Math.round(value * 100) / 100;
const toDateKey = (value: Date) => value.toISOString().slice(0, 10).replace(/-/g, '');
const normalize = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');

export function paymentFingerprint(input: PaymentInput) {
  const canonical = { reference: input.reference, method: input.method, amount: input.amount, paidAt: input.paidAt ?? null, allocations: [...input.allocations].sort((a, b) => a.invoiceId.localeCompare(b.invoiceId)) };
  return createHash('sha256').update(JSON.stringify(canonical)).digest('hex');
}

async function getEffectiveTariffs(tx: Prisma.TransactionClient, tenantId: string, periodStart: Date) {
  return tx.$queryRaw<TariffRow[]>`SELECT "id","name","serviceCode","billingUnit","unitPrice" FROM "Tariff" WHERE "tenantId"=${tenantId} AND "isActive"=TRUE AND "effectiveFrom"<=${periodStart} AND ("effectiveTo" IS NULL OR "effectiveTo">${periodStart})`;
}

async function assertAccountingPeriodOpen(tx: Prisma.TransactionClient, tenantId: string, date: Date) {
  const [table] = await tx.$queryRaw<Array<{ name: string | null }>>`SELECT to_regclass('"AccountingPeriod"')::text AS "name"`;
  if (!table?.name) return;
  const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "AccountingPeriod" WHERE "tenantId"=${tenantId} AND "isLocked"=TRUE AND "periodStart"<=${date} AND "periodEnd">=${date} LIMIT 1`;
  if (locked.length) throw new Error('Accounting period is locked.');
}

async function applyCreditBalance(tx: Prisma.TransactionClient, tenantId: string, unitId: string, invoiceTotal: number) {
  const rows = await tx.$queryRaw<Array<{ amount: Prisma.Decimal }>>`SELECT "amount" FROM "CreditBalance" WHERE "tenantId"=${tenantId} AND "unitId"=${unitId} FOR UPDATE`;
  const available = toMoney(Number(rows[0]?.amount ?? 0));
  const applied = Math.min(available, invoiceTotal);
  if (applied <= 0) return 0;
  await tx.$executeRaw`UPDATE "CreditBalance" SET "amount"=${toMoney(available - applied)},"updatedAt"=NOW() WHERE "tenantId"=${tenantId} AND "unitId"=${unitId}`;
  return applied;
}

async function addCreditBalance(tx: Prisma.TransactionClient, tenantId: string, unitId: string, amount: number) {
  if (amount <= 0) return;
  await tx.$executeRaw`INSERT INTO "CreditBalance" ("id","tenantId","unitId","amount","createdAt","updatedAt") VALUES (${randomUUID()},${tenantId},${unitId},${toMoney(amount)},NOW(),NOW()) ON CONFLICT ("tenantId","unitId") DO UPDATE SET "amount"="CreditBalance"."amount"+EXCLUDED."amount","updatedAt"=NOW()`;
}

function findTariff(tariffs: TariffRow[], predicates: Array<(tariff: TariffRow) => boolean>) {
  return tariffs.find((tariff) => predicates.some((predicate) => predicate(tariff)));
}

async function buildAutomaticInvoiceLines(tx: Prisma.TransactionClient, tenantId: string, unit: UnitForInvoice, input: InvoiceInput, tariffs: TariffRow[]) {
  const lines: InvoiceLineDraft[] = [];
  const periodStart = new Date(input.periodStart);
  const periodEnd = new Date(input.periodEnd);
  const areaTariff = findTariff(tariffs, [
    (tariff) => ['sqm', 'm2', 'area', 'square_meter'].includes(normalize(tariff.billingUnit)),
    (tariff) => ['sqm', 'm2', 'area', 'square_meter'].includes(normalize(tariff.serviceCode)),
  ]);
  if ((input.includeAreaCharges ?? true) && areaTariff && unit.areaSqm && unit.areaSqm > 0) {
    lines.push({ tariffId: areaTariff.id, description: `${areaTariff.name} (${unit.areaSqm} м²)`, quantity: unit.areaSqm, unitPrice: Number(areaTariff.unitPrice) });
  }

  if (input.includeMeterCharges ?? true) {
    const usages = await tx.$queryRaw<Array<{ type: string; usage: Prisma.Decimal }>>`
      SELECT "Meter"."type"::text AS "type", COALESCE(SUM("MeterReading"."usage"),0) AS "usage"
      FROM "MeterReading"
      JOIN "Meter" ON "Meter"."id"="MeterReading"."meterId"
      WHERE "Meter"."tenantId"=${tenantId} AND "Meter"."unitId"=${unit.id} AND "Meter"."isActive"=TRUE
        AND "MeterReading"."status"=CAST('approved' AS "MeterReadingStatus")
        AND "MeterReading"."readAt">=${periodStart} AND "MeterReading"."readAt"<=${periodEnd}
      GROUP BY "Meter"."type"`;
    for (const row of usages) {
      const meterType = normalize(row.type);
      const tariff = findTariff(tariffs, [
        (item) => normalize(item.serviceCode) === meterType,
        (item) => normalize(item.billingUnit) === meterType,
        (item) => meterType === 'water' && ['m3', 'meter'].includes(normalize(item.billingUnit)),
        (item) => meterType === 'electricity' && ['kwh', 'kw_h'].includes(normalize(item.billingUnit)),
      ]);
      const quantity = Number(row.usage);
      if (tariff && quantity > 0) lines.push({ tariffId: tariff.id, description: `${tariff.name} (${row.type})`, quantity, unitPrice: Number(tariff.unitPrice) });
    }
  }

  if (input.includeOutstanding ?? true) {
    const balances = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`
      SELECT COALESCE(SUM("Invoice"."totalAmount" - COALESCE("paid"."amount",0)),0) AS "balance"
      FROM "Invoice"
      LEFT JOIN (SELECT "invoiceId", SUM("amount") AS "amount" FROM "PaymentAllocation" WHERE "tenantId"=${tenantId} GROUP BY "invoiceId") AS "paid" ON "paid"."invoiceId"="Invoice"."id"
      WHERE "Invoice"."tenantId"=${tenantId} AND "Invoice"."unitId"=${unit.id}
        AND "Invoice"."status" NOT IN (CAST('draft' AS "InvoiceStatus"), CAST('void' AS "InvoiceStatus"), CAST('paid' AS "InvoiceStatus"))
        AND "Invoice"."periodStart"<${periodStart}`;
    const outstanding = toMoney(Number(balances[0]?.balance ?? 0));
    if (outstanding > 0) lines.push({ description: 'Өмнөх авлага', quantity: 1, unitPrice: outstanding });
    const penaltyRate = input.penaltyRate ?? 0;
    if (outstanding > 0 && penaltyRate > 0) {
      const overdue = await tx.$queryRaw<Array<{ balance: Prisma.Decimal }>>`
        SELECT COALESCE(SUM("Invoice"."totalAmount" - COALESCE("paid"."amount",0)),0) AS "balance"
        FROM "Invoice"
        LEFT JOIN (SELECT "invoiceId", SUM("amount") AS "amount" FROM "PaymentAllocation" WHERE "tenantId"=${tenantId} GROUP BY "invoiceId") AS "paid" ON "paid"."invoiceId"="Invoice"."id"
        WHERE "Invoice"."tenantId"=${tenantId} AND "Invoice"."unitId"=${unit.id}
          AND "Invoice"."status" NOT IN (CAST('draft' AS "InvoiceStatus"), CAST('void' AS "InvoiceStatus"), CAST('paid' AS "InvoiceStatus"))
          AND "Invoice"."dueAt"<${new Date(periodStart.getTime() - (input.penaltyGraceDays ?? 0) * 86400000)}`;
      const penalty = toMoney(Number(overdue[0]?.balance ?? 0) * penaltyRate);
      if (penalty > 0) lines.push({ description: 'Алданги', quantity: 1, unitPrice: penalty });
    }
  }
  return lines;
}

export function generateInvoices(prisma: PrismaClient, tenantId: string, input: InvoiceInput) {
  return prisma.$transaction(async (tx) => {
    const created: string[] = [];
    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const dueAt = new Date(input.dueAt);
    await assertAccountingPeriodOpen(tx, tenantId, periodStart);
    const tariffs = await getEffectiveTariffs(tx, tenantId, periodStart);
    for (const draft of input.invoices) {
      const units = await tx.$queryRaw<UnitForInvoice[]>`SELECT "Unit"."id","Unit"."number","Unit"."areaSqm",(SELECT "id" FROM "ResidentProfile" WHERE "tenantId"=${tenantId} AND "unitId"="Unit"."id" AND "status"=CAST('active' AS "ResidentStatus") ORDER BY "isPrimary" DESC,"createdAt" DESC LIMIT 1) AS "residentProfileId" FROM "Unit" WHERE "id"=${draft.unitId} AND "tenantId"=${tenantId}`;
      const unit = units[0];
      if (!unit) throw new Error('Unit not found in tenant.');
      const invoiceId = randomUUID();
      const invoiceNumber = draft.number ?? `INV-${toDateKey(periodStart)}-${unit.number}`;
      const draftLines = draft.lines ?? await buildAutomaticInvoiceLines(tx, tenantId, unit, input, tariffs);
      if (!draftLines.length) throw new Error(`No billable charges found for unit ${unit.number}.`);
      const pricedLines = [];
      for (const line of draftLines) {
        let unitPrice = line.unitPrice;
        if (line.tariffId) {
          const tariff = tariffs.find((item) => item.id === line.tariffId);
          if (!tariff) throw new Error('No effective tariff found for invoice period.');
          unitPrice = Number(tariff.unitPrice);
        }
        pricedLines.push({ ...line, unitPrice });
      }
      const grossTotal = toMoney(pricedLines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0));
      const creditApplied = await applyCreditBalance(tx, tenantId, draft.unitId, grossTotal);
      if (creditApplied > 0) pricedLines.push({ description: 'Credit balance', quantity: 1, unitPrice: -creditApplied });
      const total = toMoney(grossTotal - creditApplied);
      await tx.$executeRaw`INSERT INTO "Invoice" ("id","tenantId","unitId","residentProfileId","number","status","periodStart","periodEnd","dueAt","subtotal","taxAmount","totalAmount","createdAt","updatedAt") VALUES (${invoiceId},${tenantId},${draft.unitId},${draft.residentProfileId ?? unit.residentProfileId},${invoiceNumber},CAST('draft' AS "InvoiceStatus"),${periodStart},${periodEnd},${dueAt},${total},0,${total},NOW(),NOW())`;
      for (const line of pricedLines) {
        await tx.$executeRaw`INSERT INTO "InvoiceLine" ("id","tenantId","invoiceId","tariffId","description","quantity","unitPrice","amount","createdAt") VALUES (${randomUUID()},${tenantId},${invoiceId},${line.tariffId ?? null},${line.description},${line.quantity},${line.unitPrice},${toMoney(line.quantity * line.unitPrice)},NOW())`;
      }
      created.push(invoiceId);
    }
    return created;
  }, options);
}

type InvoiceAction = 'approve' | 'send' | 'void';
export const canTransitionInvoice = (status: string, action: InvoiceAction) => action === 'approve' ? status === 'draft' : action === 'send' ? status === 'approved' : ['draft', 'approved', 'sent'].includes(status);

export function transitionInvoice(prisma: PrismaClient, tenantId: string, invoiceId: string, action: InvoiceAction) {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string; totalAmount: Prisma.Decimal; periodStart: Date }>>`SELECT "status"::text AS "status","totalAmount","periodStart" FROM "Invoice" WHERE "id"=${invoiceId} AND "tenantId"=${tenantId} FOR UPDATE`;
    const invoice = rows[0];
    if (!invoice) throw new Error('Invoice not found in tenant.');
    await assertAccountingPeriodOpen(tx, tenantId, invoice.periodStart);
    if (!canTransitionInvoice(invoice.status, action)) throw new Error(`Invoice cannot ${action} from ${invoice.status}.`);
    if (action === 'approve') {
      await tx.$executeRaw`UPDATE "Invoice" SET "status"=CAST('approved' AS "InvoiceStatus"),"approvedAt"=NOW(),"updatedAt"=NOW() WHERE "id"=${invoiceId} AND "tenantId"=${tenantId}`;
      await tx.$executeRaw`INSERT INTO "LedgerEntry" ("id","tenantId","invoiceId","type","account","amount","description","occurredAt","createdAt") VALUES (${randomUUID()},${tenantId},${invoiceId},CAST('debit' AS "LedgerEntryType"),'accounts_receivable',${invoice.totalAmount},'Invoice approved',NOW(),NOW())`;
    } else if (action === 'send') await tx.$executeRaw`UPDATE "Invoice" SET "status"=CAST('sent' AS "InvoiceStatus"),"sentAt"=NOW(),"updatedAt"=NOW() WHERE "id"=${invoiceId} AND "tenantId"=${tenantId}`;
    else {
      await tx.$executeRaw`UPDATE "Invoice" SET "status"=CAST('void' AS "InvoiceStatus"),"updatedAt"=NOW() WHERE "id"=${invoiceId} AND "tenantId"=${tenantId}`;
      if (invoice.status !== 'draft') await tx.$executeRaw`INSERT INTO "LedgerEntry" ("id","tenantId","invoiceId","type","account","amount","description","occurredAt","createdAt") VALUES (${randomUUID()},${tenantId},${invoiceId},CAST('adjustment' AS "LedgerEntryType"),'accounts_receivable',${-Number(invoice.totalAmount)},'Invoice voided',NOW(),NOW())`;
    }
    return action === 'approve' ? 'approved' : action === 'send' ? 'sent' : 'void';
  }, options);
}

export function allocatePayment(prisma: PrismaClient, tenantId: string, input: PaymentInput) {
  return prisma.$transaction(async (tx) => {
    const paymentId = randomUUID();
    const requestHash = paymentFingerprint(input);
    const paidAt = input.paidAt ? new Date(input.paidAt) : new Date();
    await assertAccountingPeriodOpen(tx, tenantId, paidAt);
    const inserted = await tx.$executeRaw`INSERT INTO "Payment" ("id","tenantId","reference","requestHash","method","status","amount","paidAt","createdAt","updatedAt") VALUES (${paymentId},${tenantId},${input.reference},${requestHash},${input.method},CAST('confirmed' AS "PaymentStatus"),${input.amount},${paidAt},NOW(),NOW()) ON CONFLICT ("tenantId","reference") DO NOTHING`;
    if (!inserted) {
      const existing = await tx.$queryRaw<Array<{ id: string; requestHash: string | null }>>`SELECT "id","requestHash" FROM "Payment" WHERE "tenantId"=${tenantId} AND "reference"=${input.reference}`;
      if (existing[0]?.requestHash !== requestHash) throw new Error('Payment reference is already used with different details.');
      return existing[0].id;
    }
    let creditUnitId: string | null = null;
    for (const allocation of input.allocations) {
      const invoice = await tx.$queryRaw<Array<{ id: string; unitId: string; periodStart: Date }>>`SELECT "id","unitId","periodStart" FROM "Invoice" WHERE "id"=${allocation.invoiceId} AND "tenantId"=${tenantId} FOR UPDATE`;
      if (!invoice.length) throw new Error('Invoice not found in tenant.');
      await assertAccountingPeriodOpen(tx, tenantId, invoice[0].periodStart);
      creditUnitId ??= invoice[0].unitId;
      await tx.$executeRaw`INSERT INTO "PaymentAllocation" ("id","tenantId","paymentId","invoiceId","amount","createdAt") VALUES (${randomUUID()},${tenantId},${paymentId},${allocation.invoiceId},${allocation.amount},NOW())`;
      await tx.$executeRaw`UPDATE "Invoice" SET "status"=CASE WHEN (SELECT COALESCE(SUM("amount"),0) FROM "PaymentAllocation" WHERE "invoiceId"=${allocation.invoiceId} AND "tenantId"=${tenantId}) >= "totalAmount" THEN CAST('paid' AS "InvoiceStatus") ELSE "status" END, "paidAt"=CASE WHEN (SELECT COALESCE(SUM("amount"),0) FROM "PaymentAllocation" WHERE "invoiceId"=${allocation.invoiceId} AND "tenantId"=${tenantId}) >= "totalAmount" THEN NOW() ELSE "paidAt" END, "updatedAt"=NOW() WHERE "id"=${allocation.invoiceId} AND "tenantId"=${tenantId}`;
    }
    const allocated = input.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
    await addCreditBalance(tx, tenantId, creditUnitId ?? '', input.amount - allocated);
    await tx.$executeRaw`INSERT INTO "LedgerEntry" ("id","tenantId","paymentId","type","account","amount","description","occurredAt","createdAt") VALUES (${randomUUID()},${tenantId},${paymentId},CAST('credit' AS "LedgerEntryType"),'accounts_receivable',${input.amount},'Payment allocated',NOW(),NOW())`;
    return paymentId;
  }, options);
}

export function importResidents(prisma: PrismaClient, tenantId: string, input: ResidentImportInput) {
  return prisma.$transaction(async (tx) => {
    const result = { created: 0, duplicates: 0 };
    for (const row of input.rows) {
      if (row.unitId) {
        const unit = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Unit" WHERE "id"=${row.unitId} AND "tenantId"=${tenantId}`;
        if (!unit.length) throw new Error('Unit not found in tenant.');
      }
      const duplicate = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "Invite" WHERE "tenantId"=${tenantId} AND LOWER("email")=LOWER(${row.email}) AND "status"=CAST('pending' AS "InviteStatus")`;
      if (duplicate.length) { result.duplicates += 1; continue; }
      const tokenHash = createHash('sha256').update(randomUUID()).digest('hex');
      await tx.$executeRaw`INSERT INTO "Invite" ("id","tenantId","unitId","email","phone","role","tokenHash","status","expiresAt","createdAt","updatedAt") VALUES (${randomUUID()},${tenantId},${row.unitId ?? null},${row.email.toLowerCase()},${row.phone ?? null},CAST('resident' AS "UserRole"),${tokenHash},CAST('pending' AS "InviteStatus"),${new Date(Date.now() + 7 * 86400000)},NOW(),NOW())`;
      result.created += 1;
    }
    return result;
  }, options);
}
