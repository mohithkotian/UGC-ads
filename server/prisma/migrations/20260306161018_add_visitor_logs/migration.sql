-- CreateTable
CREATE TABLE "VisitorLog" (
    "id" TEXT NOT NULL,
    "ip" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "deviceType" TEXT NOT NULL,
    "browser" TEXT NOT NULL,
    "os" TEXT NOT NULL,
    "userAgent" TEXT NOT NULL,
    "referer" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "visitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitorLog_pkey" PRIMARY KEY ("id")
);
