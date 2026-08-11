CREATE TABLE "RefreshToken" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "userId" TEXT NOT NULL, "familyId" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "replacedBy" TEXT, "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "RefreshToken_userId_revokedAt_idx" ON "RefreshToken"("userId","revokedAt");
CREATE INDEX "RefreshToken_tenantId_familyId_idx" ON "RefreshToken"("tenantId","familyId");
CREATE INDEX "RefreshToken_familyId_revokedAt_idx" ON "RefreshToken"("familyId","revokedAt");
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
