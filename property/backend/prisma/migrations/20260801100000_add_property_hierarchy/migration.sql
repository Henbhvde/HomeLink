CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');
CREATE TYPE "UnitStatus" AS ENUM ('vacant', 'occupied', 'inactive');
CREATE TYPE "ResidentStatus" AS ENUM ('invited', 'active', 'inactive');

CREATE TABLE "Subscription" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "plan" TEXT NOT NULL, "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing', "currentPeriodStart" TIMESTAMP(3), "currentPeriodEnd" TIMESTAMP(3), "canceledAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Building" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "code" TEXT NOT NULL, "address" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Building_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Entrance" ("id" TEXT NOT NULL, "buildingId" TEXT NOT NULL, "name" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Entrance_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Floor" ("id" TEXT NOT NULL, "entranceId" TEXT NOT NULL, "number" INTEGER NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Floor_pkey" PRIMARY KEY ("id"));
CREATE TABLE "Unit" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "floorId" TEXT NOT NULL, "number" TEXT NOT NULL, "areaSqm" DOUBLE PRECISION, "status" "UnitStatus" NOT NULL DEFAULT 'vacant', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "Unit_pkey" PRIMARY KEY ("id"));
CREATE TABLE "ResidentProfile" ("id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "unitId" TEXT, "status" "ResidentStatus" NOT NULL DEFAULT 'invited', "isOwner" BOOLEAN NOT NULL DEFAULT false, "isPrimary" BOOLEAN NOT NULL DEFAULT false, "moveInAt" TIMESTAMP(3), "moveOutAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "ResidentProfile_pkey" PRIMARY KEY ("id"));

CREATE UNIQUE INDEX "Subscription_tenantId_key" ON "Subscription"("tenantId");
CREATE UNIQUE INDEX "Building_tenantId_code_key" ON "Building"("tenantId", "code");
CREATE INDEX "Building_tenantId_idx" ON "Building"("tenantId");
CREATE UNIQUE INDEX "Entrance_buildingId_name_key" ON "Entrance"("buildingId", "name");
CREATE INDEX "Entrance_buildingId_idx" ON "Entrance"("buildingId");
CREATE UNIQUE INDEX "Floor_entranceId_number_key" ON "Floor"("entranceId", "number");
CREATE INDEX "Floor_entranceId_idx" ON "Floor"("entranceId");
CREATE UNIQUE INDEX "Unit_floorId_number_key" ON "Unit"("floorId", "number");
CREATE INDEX "Unit_tenantId_idx" ON "Unit"("tenantId");
CREATE INDEX "Unit_floorId_idx" ON "Unit"("floorId");
CREATE UNIQUE INDEX "ResidentProfile_userId_key" ON "ResidentProfile"("userId");
CREATE INDEX "ResidentProfile_tenantId_idx" ON "ResidentProfile"("tenantId");
CREATE INDEX "ResidentProfile_unitId_idx" ON "ResidentProfile"("unitId");

ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Building" ADD CONSTRAINT "Building_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Entrance" ADD CONSTRAINT "Entrance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Floor" ADD CONSTRAINT "Floor_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "Entrance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResidentProfile" ADD CONSTRAINT "ResidentProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResidentProfile" ADD CONSTRAINT "ResidentProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResidentProfile" ADD CONSTRAINT "ResidentProfile_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
