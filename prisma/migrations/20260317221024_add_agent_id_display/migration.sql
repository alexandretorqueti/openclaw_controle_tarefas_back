-- CreateTable
CREATE TABLE "agents" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_agent_avatars" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "agentId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "agent_avatars_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_agent_avatars" ("agentId", "createdAt", "filename", "id", "mimeType", "path", "size", "updatedAt") SELECT "agentId", "createdAt", "filename", "id", "mimeType", "path", "size", "updatedAt" FROM "agent_avatars";
DROP TABLE "agent_avatars";
ALTER TABLE "new_agent_avatars" RENAME TO "agent_avatars";
CREATE UNIQUE INDEX "agent_avatars_agentId_key" ON "agent_avatars"("agentId");
CREATE INDEX "agent_avatars_agentId_idx" ON "agent_avatars"("agentId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
