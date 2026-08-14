CREATE TABLE "WorkspaceMembership" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "role" "UserRole" NOT NULL DEFAULT 'manager',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkspaceMembership_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkspaceMembership_userId_tenantId_key" ON "WorkspaceMembership"("userId", "tenantId");
CREATE INDEX "WorkspaceMembership_tenantId_idx" ON "WorkspaceMembership"("tenantId");
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkspaceMembership" ADD CONSTRAINT "WorkspaceMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "WorkspaceMembership" ("id", "userId", "tenantId", "role")
SELECT CONCAT('wm-', "id", '-', "tenantId"), "id", "tenantId", "role"
FROM "User"
WHERE "tenantId" IS NOT NULL AND "role" IN ('manager', 'accountant', 'staff')
ON CONFLICT ("userId", "tenantId") DO NOTHING;
