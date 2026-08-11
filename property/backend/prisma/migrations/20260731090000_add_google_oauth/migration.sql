ALTER TABLE "User"
ADD COLUMN "oauthProvider" TEXT,
ADD COLUMN "oauthSubject" TEXT,
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "User_oauthProvider_oauthSubject_key" ON "User"("oauthProvider", "oauthSubject");
