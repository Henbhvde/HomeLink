CREATE TABLE "AppState" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppState_pkey" PRIMARY KEY ("key")
);
