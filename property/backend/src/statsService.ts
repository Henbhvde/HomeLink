import type { PrismaClient } from '@prisma/client';

const monthNames = ['1 сар', '2 сар', '3 сар', '4 сар', '5 сар', '6 сар', '7 сар', '8 сар', '9 сар', '10 сар', '11 сар', '12 сар'];
const dayNames = ['Ням', 'Даваа', 'Мягмар', 'Лхагва', 'Пүрэв', 'Баасан', 'Бямба'];

function monthWindow(offset: number, now = new Date()) {
  const anchor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end, month: anchor.getMonth(), year: anchor.getFullYear() };
}

function pctChange(current: number, previous: number) {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

function formatSignedChange(value: number) {
  return value >= 0 ? `+${value}%` : `${value}%`;
}

async function sumPaidInvoices(prisma: PrismaClient, tenantId: string, start: Date, end: Date) {
  const result = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, periodStart: { gte: start, lte: end }, status: 'paid' },
  });
  return Number(result._sum.totalAmount || 0);
}

async function sumAllInvoices(prisma: PrismaClient, tenantId: string, start: Date, end: Date) {
  const result = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, periodStart: { gte: start, lte: end } },
  });
  return Number(result._sum.totalAmount || 0);
}

async function sumUnpaidInvoices(prisma: PrismaClient, tenantId: string, start?: Date, end?: Date) {
  const result = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: {
      tenantId,
      status: { in: ['approved', 'sent', 'overdue'] },
      ...(start && end ? { periodStart: { gte: start, lte: end } } : {}),
    },
  });
  return Number(result._sum.totalAmount || 0);
}

async function sumConfirmedPayments(prisma: PrismaClient, tenantId: string, start: Date, end: Date) {
  const result = await prisma.payment.aggregate({
    _sum: { amount: true },
    where: { tenantId, status: 'confirmed', paidAt: { gte: start, lte: end } },
  });
  return Number(result._sum.amount || 0);
}

function sumExpenses(expenses: any[], start: Date, end: Date) {
  return expenses.reduce((sum, expense) => {
    const date = expense.date ? new Date(expense.date) : null;
    if (!date || date < start || date > end) return sum;
    return sum + Number(expense.amount || 0);
  }, 0);
}

function filterExpenses(expenses: any[], start: Date, end: Date) {
  return expenses.filter((expense) => {
    const date = expense.date ? new Date(expense.date) : null;
    return date && date >= start && date <= end;
  });
}

export async function getBillingStats(prisma: PrismaClient, tenantId: string, store: any) {
  const now = new Date();
  const { start, end, month, year } = monthWindow(0, now);

  const totalInvoiced = await sumAllInvoices(prisma, tenantId, start, end);
  const totalPaid = await sumPaidInvoices(prisma, tenantId, start, end);
  const receivables = await sumUnpaidInvoices(prisma, tenantId);
  const collectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  const expenses = ((await store.getScope(`${tenantId}:expense-records`)) as any[]) || [];
  const income = await sumConfirmedPayments(prisma, tenantId, start, end);
  const expenseTotal = sumExpenses(expenses, start, end);

  return {
    totalInvoiced,
    totalPaid,
    receivables,
    collectionRate,
    ledger: {
      periodLabel: `${year} ОНЫ ${month + 1}-Р САР`,
      income,
      expense: expenseTotal,
      balance: income - expenseTotal,
    },
  };
}

export async function getReportsStats(prisma: PrismaClient, tenantId: string, store: any, periodMonths = 6) {
  const now = new Date();
  const months = Math.min(Math.max(periodMonths, 1), 12);

  const revenueHistory: { label: string; value: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const { start, end, month } = monthWindow(i, now);
    const paid = await sumPaidInvoices(prisma, tenantId, start, end);
    revenueHistory.push({ label: monthNames[month], value: +(paid / 1_000_000).toFixed(1) });
  }

  const currentWindow = monthWindow(0, now);
  const previousWindow = monthWindow(1, now);
  const periodStart = monthWindow(months - 1, now).start;
  const previousPeriodStart = monthWindow(months * 2 - 1, now).start;
  const previousPeriodEnd = monthWindow(months, now).end;

  const totalRevenue = await sumPaidInvoices(prisma, tenantId, periodStart, currentWindow.end);
  const previousRevenue = await sumPaidInvoices(prisma, tenantId, previousPeriodStart, previousPeriodEnd);
  const revenueChange = pctChange(totalRevenue, previousRevenue);

  const currentInvoiced = await sumAllInvoices(prisma, tenantId, currentWindow.start, currentWindow.end);
  const currentPaid = await sumPaidInvoices(prisma, tenantId, currentWindow.start, currentWindow.end);
  const previousInvoiced = await sumAllInvoices(prisma, tenantId, previousWindow.start, previousWindow.end);
  const previousPaid = await sumPaidInvoices(prisma, tenantId, previousWindow.start, previousWindow.end);

  const collectionRate = currentInvoiced > 0 ? +((currentPaid / currentInvoiced) * 100).toFixed(1) : 0;
  const previousCollectionRate = previousInvoiced > 0 ? (previousPaid / previousInvoiced) * 100 : 0;
  const collectionChange = +(collectionRate - previousCollectionRate).toFixed(1);

  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['approved', 'sent', 'overdue'] } },
  });
  const receivablesTotal = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);
  const receivablesUnitCount = new Set(unpaidInvoices.map((invoice) => invoice.unitId)).size || 1;
  const avgReceivable = Math.round(receivablesTotal / receivablesUnitCount);

  const previousReceivables = await sumUnpaidInvoices(prisma, tenantId, previousWindow.start, previousWindow.end);
  const receivablesChange = pctChange(receivablesTotal, previousReceivables);

  const resolvedCurrent = await prisma.maintenanceRequest.count({
    where: { tenantId, status: 'resolved', resolvedAt: { gte: periodStart, lte: currentWindow.end } },
  });
  const resolvedPrevious = await prisma.maintenanceRequest.count({
    where: { tenantId, status: 'resolved', resolvedAt: { gte: previousPeriodStart, lte: previousPeriodEnd } },
  });
  const resolvedChange = pctChange(resolvedCurrent, resolvedPrevious);

  const currentMonthLines = await prisma.invoiceLine.findMany({
    where: {
      tenantId,
      invoice: { periodStart: { gte: currentWindow.start, lte: currentWindow.end }, status: { not: 'void' } },
    },
    include: { tariff: true },
  });

  const mixMap = new Map<string, number>();
  for (const line of currentMonthLines) {
    const key = line.tariff?.serviceCode || line.description;
    mixMap.set(key, (mixMap.get(key) || 0) + Number(line.amount));
  }

  const palette = ['#c5a880', '#735f44', '#393026', '#8a7355', '#564636'];
  const revenueMix = Array.from(mixMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([label, amount], index) => ({
      label,
      value: +(amount / 1_000_000).toFixed(3),
      color: palette[index % palette.length],
    }));

  const currentMonthIncome = currentPaid;

  return {
    metrics: [
      { label: 'Нийт орлого', value: totalRevenue, change: revenueChange },
      { label: 'Төлөлтийн түвшин', value: collectionRate, change: collectionChange, isPercent: true },
      { label: 'Дундаж авлага', value: avgReceivable, change: receivablesChange },
      { label: 'Шийдсэн засвар', value: resolvedCurrent, change: resolvedChange, isCount: true },
    ],
    revenueHistory,
    revenueMix,
    revenueGrowth: revenueChange,
    currentMonthIncome,
  };
}

export async function getMaintenanceStats(prisma: PrismaClient, tenantId: string) {
  const now = new Date();
  const { start, end } = monthWindow(0, now);

  const openCount = await prisma.maintenanceRequest.count({
    where: { tenantId, status: { in: ['open', 'assigned', 'in_progress'] } },
  });
  const urgentCount = await prisma.maintenanceRequest.count({
    where: {
      tenantId,
      status: { in: ['open', 'assigned', 'in_progress'] },
      priority: { in: ['urgent', 'high'] },
    },
  });

  const resolvedRequests = await prisma.maintenanceRequest.findMany({
    where: { tenantId, status: 'resolved', resolvedAt: { not: null }, createdAt: { gte: start, lte: end } },
  });

  let totalHours = 0;
  for (const request of resolvedRequests) {
    totalHours += (request.resolvedAt!.getTime() - request.createdAt.getTime()) / 3_600_000;
  }
  const avgResolutionHours = resolvedRequests.length > 0 ? +(totalHours / resolvedRequests.length).toFixed(1) : 0;

  const closedCount = await prisma.maintenanceRequest.count({
    where: { tenantId, status: { in: ['resolved', 'closed'] }, resolvedAt: { gte: start, lte: end } },
  });

  const totalRequests = await prisma.maintenanceRequest.count({ where: { tenantId } });
  const resolvedTotal = await prisma.maintenanceRequest.count({ where: { tenantId, status: { in: ['resolved', 'closed'] } } });
  const slaRate = totalRequests > 0 ? Math.round((resolvedTotal / totalRequests) * 100) : 0;

  return {
    openCount,
    urgentCount,
    avgResolutionHours,
    closedCount,
    slaRate,
  };
}

export async function getPaymentStats(prisma: PrismaClient, tenantId: string) {
  const now = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const { start, end } = monthWindow(0, now);

  const todayIncome = await sumConfirmedPayments(prisma, tenantId, dayStart, dayEnd);
  const pendingTulgah = await prisma.payment.count({ where: { tenantId, status: 'pending' } });
  const confirmedThisMonth = await prisma.payment.count({
    where: { tenantId, status: 'confirmed', paidAt: { gte: start, lte: end } },
  });

  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['approved', 'sent', 'overdue'] } },
  });
  const receivablesTotal = unpaidInvoices.reduce((sum, invoice) => sum + Number(invoice.totalAmount), 0);

  return {
    todayIncome,
    pendingTulgah,
    confirmedThisMonth,
    receivablesTotal,
  };
}

export async function getTransparencyStats(prisma: PrismaClient, tenantId: string, store: any) {
  const now = new Date();
  const reports: Array<{
    key: string;
    income: number;
    expense: number;
    balance: number;
    completion: number;
    rows: Array<{ label: string; amount: number; share: number }>;
  }> = [];

  const expenses = ((await store.getScope(`${tenantId}:expense-records`)) as any[]) || [];

  for (let offset = 0; offset < 3; offset++) {
    const { start, end, month, year } = monthWindow(offset, now);
    const income = await sumConfirmedPayments(prisma, tenantId, start, end);
    const monthExpenses = filterExpenses(expenses, start, end);
    const expenseTotal = monthExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const balance = income - expenseTotal;

    const categoryMap = new Map<string, number>();
    for (const item of monthExpenses) {
      const label = item.category || item.description || 'Бусад';
      categoryMap.set(label, (categoryMap.get(label) || 0) + Number(item.amount || 0));
    }

    const rows = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, amount]) => ({
        label,
        amount,
        share: expenseTotal > 0 ? Math.round((amount / expenseTotal) * 100) : 0,
      }));

    const invoiced = await sumAllInvoices(prisma, tenantId, start, end);
    const paid = await sumPaidInvoices(prisma, tenantId, start, end);
    const completion = invoiced > 0 ? Math.round((paid / invoiced) * 100) : 0;

    reports.push({
      key: `${year} оны ${month + 1}-р сар`,
      income,
      expense: expenseTotal,
      balance,
      completion,
      rows,
    });
  }

  return { reports };
}

export async function getAdvancedWidgetStats(prisma: PrismaClient, tenantId: string, store: any) {
  const now = new Date();

  const buildForecast = async (weeks: number, labels: string[]) => {
    const points: { label: string; value: number }[] = [];
    for (let i = weeks - 1; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7, 23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      const paid = await sumPaidInvoices(prisma, tenantId, start, end);
      const total = await sumAllInvoices(prisma, tenantId, start, end);
      const rate = total > 0 ? Math.round((paid / total) * 100) : 0;
      points.push({ label: labels[weeks - 1 - i] ?? `${weeks - i}`, value: rate });
    }
    return points;
  };

  const forecast = {
    '7d': await buildForecast(4, dayNames.slice(now.getDay() === 0 ? 1 : 0, 4).length === 4 ? dayNames.slice(1, 5) : ['Даваа', 'Мягмар', 'Лхагва', 'Пүрэв']),
    '30d': await buildForecast(4, ['1-р 7 хоног', '2-р 7 хоног', '3-р 7 хоног', '4-р 7 хоног']),
    '90d': await buildForecast(4, monthNames.slice(Math.max(0, now.getMonth() - 3), now.getMonth() + 1).slice(-4)),
  };

  const totalUnits = await prisma.unit.count({ where: { tenantId } });
  const occupiedUnits = await prisma.unit.count({ where: { tenantId, status: 'occupied' } });
  const activeResidents = await prisma.residentProfile.count({ where: { tenantId, status: 'active' } });
  const occupancy = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const openRequests = await prisma.maintenanceRequest.count({
    where: { tenantId, status: { in: ['open', 'assigned', 'in_progress'] } },
  });

  const slaAtRisk = await prisma.maintenanceRequest.count({
    where: {
      tenantId,
      status: { in: ['open', 'assigned', 'in_progress'] },
      slaDueAt: { lt: now },
    },
  });

  const { start, end } = monthWindow(0, now);
  const currentIncome = await sumConfirmedPayments(prisma, tenantId, start, end);
  const previousIncome = await sumConfirmedPayments(prisma, tenantId, monthWindow(1, now).start, monthWindow(1, now).end);
  const forecastGrowth = pctChange(currentIncome, previousIncome);

  return {
    forecast,
    occupancy,
    activeResidents,
    totalUnits,
    slaAtRisk,
    openRequests,
    forecastAmount: currentIncome,
    forecastGrowth,
  };
}

export { formatSignedChange, pctChange, monthNames };
