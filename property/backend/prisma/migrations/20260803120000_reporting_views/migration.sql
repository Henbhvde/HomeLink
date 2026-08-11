-- Create View for Tenant Billing Summary
CREATE OR REPLACE VIEW "TenantBillingSummary" AS
SELECT
  t.id AS "tenantId",
  t.name AS "tenantName",
  COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i."totalAmount" ELSE 0.0 END), 0.0) AS "totalPaidAmount",
  COALESCE(SUM(CASE WHEN i.status IN ('approved', 'sent', 'overdue') THEN i."totalAmount" ELSE 0.0 END), 0.0) AS "totalUnpaidAmount",
  COALESCE(SUM(i."totalAmount"), 0.0) AS "totalInvoicedAmount"
FROM "Tenant" t
LEFT JOIN "Invoice" i ON t.id = i."tenantId"
GROUP BY t.id, t.name;

-- Create View for Utility Consumption Report
CREATE OR REPLACE VIEW "MonthlyUtilityConsumption" AS
SELECT
  mr."tenantId",
  m.type AS "meterType",
  DATE_TRUNC('month', mr."readAt") AS "billingMonth",
  SUM(mr.usage) AS "totalUsage",
  COUNT(mr.id) AS "readingsCount"
FROM "MeterReading" mr
JOIN "Meter" m ON mr."meterId" = m.id
GROUP BY mr."tenantId", m.type, DATE_TRUNC('month', mr."readAt");

-- Create View for Maintenance SLA Performance Report
CREATE OR REPLACE VIEW "MaintenancePerformance" AS
SELECT
  mr."tenantId",
  COUNT(mr.id) AS "totalRequests",
  SUM(CASE WHEN mr.status = 'resolved' THEN 1 ELSE 0 END) AS "resolvedRequests",
  SUM(CASE WHEN mr.status IN ('open', 'assigned', 'in_progress') THEN 1 ELSE 0 END) AS "activeRequests",
  AVG(CASE WHEN mr.status = 'resolved' AND mr."resolvedAt" IS NOT NULL AND mr."createdAt" IS NOT NULL
           THEN EXTRACT(EPOCH FROM (mr."resolvedAt" - mr."createdAt")) / 3600.0
           ELSE NULL END) AS "avgResolutionTimeHours"
FROM "MaintenanceRequest" mr
GROUP BY mr."tenantId";
