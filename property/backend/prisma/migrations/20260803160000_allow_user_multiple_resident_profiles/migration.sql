DROP INDEX IF EXISTS "ResidentProfile_userId_key";
CREATE INDEX IF NOT EXISTS "ResidentProfile_tenantId_userId_idx" ON "ResidentProfile"("tenantId","userId");
CREATE INDEX IF NOT EXISTS "ResidentProfile_tenantId_unitId_idx" ON "ResidentProfile"("tenantId","unitId");
