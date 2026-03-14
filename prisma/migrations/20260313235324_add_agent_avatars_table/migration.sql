-- CreateTable
CREATE TABLE "agent_avatars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_avatars_agentId_key" ON "agent_avatars"("agentId");

-- CreateIndex
CREATE INDEX "agent_avatars_agentId_idx" ON "agent_avatars"("agentId");
