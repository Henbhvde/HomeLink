ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'unassigned';
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'unassigned';
