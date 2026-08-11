CREATE TYPE "TenantAccessStatus" AS ENUM ('pending','active','trial','overdue','read_only','rejected');
ALTER TABLE "Tenant" ADD COLUMN "status" "TenantAccessStatus" NOT NULL DEFAULT 'active';
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");
