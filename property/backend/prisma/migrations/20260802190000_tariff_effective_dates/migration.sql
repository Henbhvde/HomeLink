ALTER TABLE "Tariff" ADD COLUMN "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "effectiveTo" TIMESTAMP(3);
DROP INDEX "Tariff_tenantId_serviceCode_key";
CREATE UNIQUE INDEX "Tariff_tenantId_serviceCode_effectiveFrom_key" ON "Tariff"("tenantId", "serviceCode", "effectiveFrom");
CREATE INDEX "Tariff_tenantId_isActive_effectiveFrom_idx" ON "Tariff"("tenantId", "isActive", "effectiveFrom");
