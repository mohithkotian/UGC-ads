-- AlterTable
ALTER TABLE "VisitorLog" ADD COLUMN     "isNew" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionId" TEXT NOT NULL DEFAULT 'unknown',
ADD COLUMN     "timeOnPage" INTEGER,
ADD COLUMN     "visitorId" TEXT NOT NULL DEFAULT 'unknown';

-- CreateTable
CREATE TABLE "ClickLog" (
    "id" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL DEFAULT 'unknown',
    "sessionId" TEXT NOT NULL DEFAULT 'unknown',
    "element" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClickLog_pkey" PRIMARY KEY ("id")
);
