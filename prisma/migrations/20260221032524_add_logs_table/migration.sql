-- CreateTable
CREATE TABLE "logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL DEFAULT 'ERROR',
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "errorType" TEXT,
    "stackTrace" TEXT,
    "requestBody" TEXT,
    "requestQuery" TEXT,
    "requestParams" TEXT,
    "headers" TEXT,
    "clientIp" TEXT,
    "userId" TEXT,
    "correlationId" TEXT,
    "parentLogId" TEXT,
    "responseTime" INTEGER,
    CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "logs_parentLogId_fkey" FOREIGN KEY ("parentLogId") REFERENCES "logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "logs_timestamp_idx" ON "logs"("timestamp");

-- CreateIndex
CREATE INDEX "logs_level_idx" ON "logs"("level");

-- CreateIndex
CREATE INDEX "logs_endpoint_idx" ON "logs"("endpoint");

-- CreateIndex
CREATE INDEX "logs_statusCode_idx" ON "logs"("statusCode");

-- CreateIndex
CREATE INDEX "logs_userId_idx" ON "logs"("userId");

-- CreateIndex
CREATE INDEX "logs_correlationId_idx" ON "logs"("correlationId");
