ALTER TABLE "User"
ADD COLUMN "passwordResetCodeHash" TEXT,
ADD COLUMN "passwordResetExpiresAt" TIMESTAMP(3),
ADD COLUMN "passwordResetVerifiedAt" TIMESTAMP(3);
