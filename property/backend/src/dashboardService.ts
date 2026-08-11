import type { PrismaClient } from '@prisma/client';
import { getAdvancedWidgetStats } from './statsService.js';

export async function getManagerDashboardStats(prisma: PrismaClient, tenantId: string, store?: any) {
  const now = new Date();
  const property = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { name: true, buildings: { select: { name: true, address: true }, orderBy: { createdAt: 'asc' }, take: 1 } },
  });
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // 1. Collection Pulse
  const paidInvoicesTotal = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, status: 'paid' }
  });
  const unpaidInvoicesTotal = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, status: { in: ['approved', 'sent', 'overdue'] } }
  });

  const totalPaid = Number(paidInvoicesTotal._sum.totalAmount || 0);
  const totalUnpaid = Number(unpaidInvoicesTotal._sum.totalAmount || 0);
  const totalInvoiced = totalPaid + totalUnpaid;
  const currentCollectionRate = totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 0;

  // Let's calculate previous month collection rate for growth calculation
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

  const prevPaidTotal = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, periodStart: { gte: lastMonthStart, lte: lastMonthEnd }, status: 'paid' }
  });
  const prevUnpaidTotal = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, periodStart: { gte: lastMonthStart, lte: lastMonthEnd }, status: { in: ['approved', 'sent', 'overdue'] } }
  });

  const prevPaid = Number(prevPaidTotal._sum.totalAmount || 0);
  const prevUnpaid = Number(prevUnpaidTotal._sum.totalAmount || 0);
  const prevTotal = prevPaid + prevUnpaid;
  const prevCollectionRate = prevTotal > 0 ? Math.round((prevPaid / prevTotal) * 100) : 0;

  const collectionGrowth = +(currentCollectionRate - prevCollectionRate).toFixed(1);

  // 2. Attention items (Priority Queue)
  const overdueUnits = await prisma.invoice.groupBy({
    by: ['unitId'],
    where: { tenantId, status: 'overdue' }
  });
  const overdueUnitsCount = overdueUnits.length;

  const urgentRequestsCount = await prisma.maintenanceRequest.count({
    where: {
      tenantId,
      status: { in: ['open', 'assigned', 'in_progress'] },
      priority: { in: ['urgent', 'high'] }
    }
  });

  const latestAnnouncement = await prisma.announcement.findFirst({
    where: { tenantId, publishedAt: { not: null } },
    orderBy: { createdAt: 'desc' }
  });

  const attention = [
    { title: 'Төлбөрийн хугацаа хэтэрсэн', note: `${overdueUnitsCount} айл`, tone: 'warning' as const },
    { title: 'Яаралтай засварын хүсэлт', note: `${urgentRequestsCount} хүсэлт`, tone: 'danger' as const },
    {
      title: latestAnnouncement ? latestAnnouncement.title : 'Шинэ зарлал байхгүй',
      note: latestAnnouncement ? 'Шинэ зарлал' : 'Одоогоор идэвхтэй зарлал алга',
      tone: 'info' as const
    }
  ];

  // 3. Receivables (Авлагын үлдэгдэл)
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['approved', 'sent', 'overdue'] } }
  });
  const receivablesTotal = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const receivablesUnitCount = new Set(unpaidInvoices.map((i) => i.unitId)).size;

  // Receivables growth estimate
  const prevMonthUnpaidInvoices = await prisma.invoice.aggregate({
    _sum: { totalAmount: true },
    where: { tenantId, periodStart: { gte: lastMonthStart, lte: lastMonthEnd }, status: { in: ['approved', 'sent', 'overdue'] } }
  });
  const prevReceivables = Number(prevMonthUnpaidInvoices._sum.totalAmount || 0);
  const receivablesChange = prevReceivables > 0 ? +(((receivablesTotal - prevReceivables) / prevReceivables) * 100).toFixed(1) : receivablesTotal > 0 ? 100 : 0;

  // 4. Resolution average time
  const resolvedRequests = await prisma.maintenanceRequest.findMany({
    where: { tenantId, status: 'resolved', resolvedAt: { not: null } }
  });

  let totalResHours = 0;
  for (const r of resolvedRequests) {
    totalResHours += (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600000;
  }
  const avgResolutionTime = resolvedRequests.length > 0 ? +(totalResHours / resolvedRequests.length).toFixed(1) : 0;

  // Last month's resolved requests comparison
  const prevResolvedRequests = await prisma.maintenanceRequest.findMany({
    where: { tenantId, status: 'resolved', resolvedAt: { not: null }, createdAt: { gte: lastMonthStart, lte: lastMonthEnd } }
  });
  let prevTotalResHours = 0;
  for (const r of prevResolvedRequests) {
    prevTotalResHours += (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600000;
  }
  const prevAvgResolutionTime = prevResolvedRequests.length > 0 ? prevTotalResHours / prevResolvedRequests.length : 0;
  const resolutionTimeChange = +(avgResolutionTime - prevAvgResolutionTime).toFixed(1);

  // 5. Monthly collection chart (last 6 months)
  const monthlyCollection = [];
  const monthNames = ['1 сар', '2 сар', '3 сар', '4 сар', '5 сар', '6 сар', '7 сар', '8 сар', '9 сар', '10 сар', '11 сар', '12 сар'];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

    const paidAggr = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId, periodStart: { gte: start, lte: end }, status: 'paid' }
    });
    const totalAggr = await prisma.invoice.aggregate({
      _sum: { totalAmount: true },
      where: { tenantId, periodStart: { gte: start, lte: end } }
    });

    const pAmt = Number(paidAggr._sum.totalAmount || 0);
    const tAmt = Number(totalAggr._sum.totalAmount || 0);
    const rate = tAmt > 0 ? Math.round((pAmt / tAmt) * 100) : 0;

    monthlyCollection.push({
      month: monthNames[d.getMonth()],
      value: rate
    });
  }

  // 6. Service SLA Details
  const totalRequests = await prisma.maintenanceRequest.count({ where: { tenantId } });
  const openCount = await prisma.maintenanceRequest.count({
    where: { tenantId, status: { in: ['open', 'assigned', 'in_progress'] } }
  });
  const slaRate = totalRequests > 0 ? Math.round((resolvedRequests.length / totalRequests) * 100) : 0;

  // Urgent average resolution time
  const urgentResolved = resolvedRequests.filter((r) => r.priority === 'urgent' || r.priority === 'high');
  let urgentResHours = 0;
  for (const r of urgentResolved) {
    urgentResHours += (r.resolvedAt!.getTime() - r.createdAt.getTime()) / 3600000;
  }
  const avgUrgentTime = urgentResolved.length > 0 ? +(urgentResHours / urgentResolved.length).toFixed(1) : 0;

  // 7. Residence Matrix
  const activeResidents = await prisma.residentProfile.count({ where: { tenantId, status: 'active' } });
  const totalResidents = await prisma.residentProfile.count({ where: { tenantId } });
  const currentMonthResidents = await prisma.residentProfile.count({
    where: { tenantId, createdAt: { gte: currentMonthStart, lte: currentMonthEnd } }
  });

  // 8. AR Aging
  let age0to30 = 0;
  let age31to60 = 0;
  let age61plus = 0;

  for (const inv of unpaidInvoices) {
    const dueMs = inv.dueAt.getTime();
    const diffDays = Math.max(0, (now.getTime() - dueMs) / (1000 * 60 * 60 * 24));
    const amt = Number(inv.totalAmount);
    if (diffDays <= 30) {
      age0to30 += amt;
    } else if (diffDays <= 60) {
      age31to60 += amt;
    } else {
      age61plus += amt;
    }
  }

  const advancedWidgets = store ? await getAdvancedWidgetStats(prisma, tenantId, store) : null;

  return {
    collection: {
      rate: currentCollectionRate,
      target: 95,
      growth: collectionGrowth
    },
    attention,
    receivables: {
      total: receivablesTotal,
      unitCount: receivablesUnitCount,
      change: receivablesChange
    },
    resolution: {
      avgHours: avgResolutionTime,
      change: resolutionTimeChange
    },
    monthlyCollection,
    serviceSla: {
      slaRate,
      avgHours: avgResolutionTime,
      urgentHours: avgUrgentTime,
      openCount
    },
    residence: {
      activeCount: activeResidents,
      totalCount: totalResidents,
      newCount: currentMonthResidents,
      property: {
        name: property?.buildings[0]?.name || property?.name || 'HomeLink',
        address: property?.buildings[0]?.address || `${property?.name || 'HomeLink'}, Ulaanbaatar`,
      }
    },
    advancedWidgets,
    aging: {
      age0to30,
      age31to60,
      age61plus
    }
  };
}

export async function getAccountantDashboardStats(prisma: PrismaClient, tenantId: string, store: any) {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  // Invoices in current month
  const currentInvoices = await prisma.invoice.findMany({
    where: { tenantId, periodStart: { gte: currentMonthStart, lte: currentMonthEnd } }
  });

  const monthlyCashAmount = currentInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const currentPaid = currentInvoices.filter((i) => i.status === 'paid').reduce((sum, i) => sum + Number(i.totalAmount), 0);
  const currentCollectionRate = monthlyCashAmount > 0 ? Math.round((currentPaid / monthlyCashAmount) * 100) : 0;

  const unitCount = await prisma.unit.count({ where: { tenantId } });
  const pendingTulgah = await prisma.payment.count({ where: { tenantId, status: 'pending' } });

  // Receivables (unpaid total)
  const unpaidInvoices = await prisma.invoice.findMany({
    where: { tenantId, status: { in: ['approved', 'sent', 'overdue'] } }
  });
  const receivablesTotal = unpaidInvoices.reduce((sum, i) => sum + Number(i.totalAmount), 0);

  const currentReceiptsCount = await prisma.payment.count({
    where: { tenantId, status: 'confirmed', paidAt: { gte: currentMonthStart, lte: currentMonthEnd } }
  });

  const batlahZaaltt = await prisma.meterReading.count({ where: { tenantId, status: 'pending' } });
  const zuruuteiZaaltt = await prisma.meterReading.count({ where: { tenantId, status: 'flagged' } });

  // Expenses
  const expenses = (await store.getScope(`${tenantId}:expense-records`)) as any[] || [];
  const expenseTotal = expenses.reduce((sum, exp) => {
    const expTime = exp.date ? new Date(exp.date).getTime() : null;
    if (!expTime || expTime < currentMonthStart.getTime() || expTime > currentMonthEnd.getTime()) return sum;
    return sum + Number(exp.amount || 0);
  }, 0);
  const zarlaгынБаримт = expenses.length;

  // Approved meter readings rate
  const currentReadings = await prisma.meterReading.findMany({
    where: { tenantId, readAt: { gte: currentMonthStart, lte: currentMonthEnd } }
  });
  const approvedReadings = currentReadings.filter((r) => r.status === 'approved').length;
  const readingsApprovalRate = currentReadings.length > 0 ? Math.round((approvedReadings / currentReadings.length) * 100) : 0;

  // Dynamic cashflow charts data points
  // Let's divide the month into 4 weeks and aggregate payments (income) and expenses (expense)
  const payments = await prisma.payment.findMany({
    where: { tenantId, status: 'confirmed', paidAt: { gte: currentMonthStart, lte: currentMonthEnd } }
  });

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const incomeWeekly = [0, 0, 0, 0];
  const expenseWeekly = [0, 0, 0, 0];

  // Distribute payments into weeks
  for (const p of payments) {
    const paidTime = p.paidAt ? p.paidAt.getTime() : p.createdAt.getTime();
    const diff = paidTime - currentMonthStart.getTime();
    const weekIndex = Math.min(3, Math.floor(diff / weekMs));
    if (weekIndex >= 0) {
      incomeWeekly[weekIndex] += Number(p.amount);
    }
  }

  // Distribute expenses into weeks
  for (const exp of expenses) {
    const expTime = exp.date ? new Date(exp.date).getTime() : new Date().getTime();
    const diff = expTime - currentMonthStart.getTime();
    const weekIndex = Math.min(3, Math.floor(diff / weekMs));
    if (weekIndex >= 0) {
      expenseWeekly[weekIndex] += Number(exp.amount || 0);
    }
  }

  // Map to scale of 0 to 100 for line chart coordinates
  const maxIncome = Math.max(...incomeWeekly, 1000000);
  const maxExpense = Math.max(...expenseWeekly, 500000);

  const incomeChart = incomeWeekly.map((val) => Math.round((val / maxIncome) * 80) + 10);
  const expenseChart = expenseWeekly.map((val) => Math.round((val / maxExpense) * 60) + 5);

  return {
    cashPosition: {
      amount: monthlyCashAmount,
      unitCount,
      collectionRate: currentCollectionRate,
      pendingTulgah
    },
    metrics: {
      invoicesCount: currentInvoices.length,
      receivables: receivablesTotal,
      receiptsCount: currentReceiptsCount,
      expense: expenseTotal
    },
    statusList: {
      batlahZaaltt,
      zuruuteiZaaltt,
      tulgahGuilgee: pendingTulgah,
      zarlaгынБаримт
    },
    cycle: {
      approvalRate: readingsApprovalRate,
      collectionRate: currentCollectionRate,
      zuruuteiCount: zuruuteiZaaltt
    },
    charts: {
      income: incomeChart,
      expense: expenseChart
    }
  };
}
