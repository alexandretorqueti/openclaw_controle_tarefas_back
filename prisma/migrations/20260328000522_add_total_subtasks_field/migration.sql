-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_tasks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "deadline" DATETIME NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurrenceType" TEXT,
    "recurrenceTimes" TEXT,
    "recurrenceDays" TEXT,
    "lastExecutedAt" DATETIME,
    "nextExecutionAt" DATETIME,
    "agent" TEXT,
    "domain" TEXT,
    "isDecomposed" BOOLEAN NOT NULL DEFAULT false,
    "isAtomic" BOOLEAN NOT NULL DEFAULT false,
    "bool_executando" BOOLEAN NOT NULL DEFAULT false,
    "bool_filho_executando" BOOLEAN NOT NULL DEFAULT false,
    "projectId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "statusId" TEXT NOT NULL,
    "priorityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "totalSubtasks" INTEGER NOT NULL DEFAULT 0,
    "arquitetosPromptContent" TEXT,
    "arquitetosAnalysisContent" TEXT,
    "arquitetosTerminalContent" TEXT,
    "programadorTerminalContent" TEXT,
    "programadorReportContent" TEXT,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "priorities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("agent", "arquitetosAnalysisContent", "arquitetosPromptContent", "arquitetosTerminalContent", "assignedToId", "bool_executando", "bool_filho_executando", "createdAt", "createdById", "deadline", "description", "domain", "id", "isAtomic", "isCompleted", "isDecomposed", "isRecurring", "lastExecutedAt", "nextExecutionAt", "parentTaskId", "position", "priorityId", "programadorReportContent", "programadorTerminalContent", "projectId", "recurrenceDays", "recurrenceTimes", "recurrenceType", "statusId", "title", "updatedAt") SELECT "agent", "arquitetosAnalysisContent", "arquitetosPromptContent", "arquitetosTerminalContent", "assignedToId", "bool_executando", "bool_filho_executando", "createdAt", "createdById", "deadline", "description", "domain", "id", "isAtomic", "isCompleted", "isDecomposed", "isRecurring", "lastExecutedAt", "nextExecutionAt", "parentTaskId", "position", "priorityId", "programadorReportContent", "programadorTerminalContent", "projectId", "recurrenceDays", "recurrenceTimes", "recurrenceType", "statusId", "title", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
