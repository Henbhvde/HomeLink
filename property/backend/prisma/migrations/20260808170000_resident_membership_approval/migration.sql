ALTER TYPE "ResidentStatus" ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE "ResidentStatus" ADD VALUE IF NOT EXISTS 'rejected';
CREATE UNIQUE INDEX IF NOT EXISTS "ResidentProfile_tenantId_userId_key" ON "ResidentProfile"("tenantId", "userId");
