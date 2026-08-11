CREATE TABLE "AccountingPeriod" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "isLocked" BOOLEAN NOT NULL DEFAULT false,
  "lockedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CreditBalance" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "unitId" TEXT NOT NULL,
  "amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX "AccountingPeriod_tenantId_periodStart_periodEnd_key" ON "AccountingPeriod"("tenantId","periodStart","periodEnd");
CREATE INDEX "AccountingPeriod_tenantId_isLocked_periodStart_periodEnd_idx" ON "AccountingPeriod"("tenantId","isLocked","periodStart","periodEnd");
CREATE UNIQUE INDEX "CreditBalance_tenantId_unitId_key" ON "CreditBalance"("tenantId","unitId");
CREATE INDEX "CreditBalance_tenantId_amount_idx" ON "CreditBalance"("tenantId","amount");

ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditBalance" ADD CONSTRAINT "CreditBalance_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
