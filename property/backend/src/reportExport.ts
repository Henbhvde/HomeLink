import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';

export type ReportType = 'invoices' | 'payments' | 'residents' | 'maintenance';
export type ReportRow = Record<string, string | number>;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? '';

export async function loadReportRows(prisma: PrismaClient, tenantId: string, report: ReportType): Promise<ReportRow[]> {
  if (report === 'invoices') return (await prisma.invoice.findMany({ where: { tenantId }, take: 10_000, orderBy: { createdAt: 'desc' } })).map((item) => ({ number: item.number, status: item.status, periodStart: date(item.periodStart), dueAt: date(item.dueAt), totalAmount: Number(item.totalAmount) }));
  if (report === 'payments') return (await prisma.payment.findMany({ where: { tenantId }, take: 10_000, orderBy: { createdAt: 'desc' } })).map((item) => ({ reference: item.reference, method: item.method, status: item.status, amount: Number(item.amount), paidAt: date(item.paidAt) }));
  if (report === 'residents') return (await prisma.residentProfile.findMany({ where: { tenantId }, take: 10_000, include: { user: true, unit: true }, orderBy: { createdAt: 'desc' } })).map((item) => ({ name: item.user.fullName, email: item.user.email, phone: item.user.phone ?? '', unit: item.unit?.number ?? '', status: item.status }));
  return (await prisma.maintenanceRequest.findMany({ where: { tenantId }, take: 10_000, orderBy: { createdAt: 'desc' } })).map((item) => ({ title: item.title, priority: item.priority, status: item.status, slaDueAt: date(item.slaDueAt), resolvedAt: date(item.resolvedAt), createdAt: date(item.createdAt) }));
}

export async function renderExcel(title: string, rows: ReportRow[]) {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet(title.slice(0, 31)); const columns = Object.keys(rows[0] ?? { message: '' });
  sheet.columns = columns.map((key) => ({ header: key, key, width: 22 })); sheet.getRow(1).font = { bold: true }; sheet.addRows(rows);
  sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = rows.length ? { from: 'A1', to: `${String.fromCharCode(64 + Math.min(columns.length, 26))}${rows.length + 1}` } : undefined;
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function renderPdf(title: string, rows: ReportRow[]) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: 'A4' }); const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(Buffer.from(chunk))); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject);
    doc.font(join(process.cwd(), 'node_modules', '@fontsource', 'noto-sans', 'files', 'noto-sans-cyrillic-400-normal.woff')).fontSize(18).text(title);
    doc.moveDown().fontSize(8); const columns = Object.keys(rows[0] ?? {}); if (columns.length) doc.text(columns.join(' | '));
    for (const row of rows) { if (doc.y > 760) doc.addPage(); doc.text(columns.map((key) => String(row[key] ?? '')).join(' | ')); }
    if (!rows.length) doc.text('Мэдээлэл олдсонгүй.'); doc.end();
  });
}
