/*
  Warnings:

  - Added the required column `nickname` to the `users` table without a default value. This is not possible if the table is not empty.

*/
-- CreateTable
CREATE TABLE "project_types" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "personaPrompt" TEXT NOT NULL,
    "baseRules" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "task_execution_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "userId" TEXT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "model" TEXT NOT NULL,
    "executionNotes" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "exitCode" INTEGER,
    "errorMessage" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "task_execution_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_execution_logs_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "level" TEXT NOT NULL,
    "endpoint" TEXT,
    "method" TEXT,
    "statusCode" INTEGER,
    "message" TEXT,
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
    CONSTRAINT "logs_parentLogId_fkey" FOREIGN KEY ("parentLogId") REFERENCES "logs" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_logs" ("clientIp", "correlationId", "endpoint", "errorType", "headers", "id", "level", "message", "method", "parentLogId", "requestBody", "requestParams", "requestQuery", "responseTime", "stackTrace", "statusCode", "timestamp", "userId") SELECT "clientIp", "correlationId", "endpoint", "errorType", "headers", "id", "level", "message", "method", "parentLogId", "requestBody", "requestParams", "requestQuery", "responseTime", "stackTrace", "statusCode", "timestamp", "userId" FROM "logs";
DROP TABLE "logs";
ALTER TABLE "new_logs" RENAME TO "logs";
CREATE TABLE "new_projects" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "regras" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdById" TEXT NOT NULL,
    "projectTypeId" TEXT,
    "frontendPath" TEXT,
    "frontendPort" INTEGER,
    "backendPath" TEXT,
    "backendPort" INTEGER,
    "repositoryUrl" TEXT,
    "pastaBase" TEXT,
    "agent" TEXT,
    "frontendBuildCmd" TEXT,
    "backendBuildCmd" TEXT,
    "modeloAuxiliar" TEXT,
    CONSTRAINT "projects_projectTypeId_fkey" FOREIGN KEY ("projectTypeId") REFERENCES "project_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "projects_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_projects" ("createdAt", "createdById", "description", "id", "name", "status", "updatedAt") SELECT "createdAt", "createdById", "description", "id", "name", "status", "updatedAt" FROM "projects";
DROP TABLE "projects";
ALTER TABLE "new_projects" RENAME TO "projects";
CREATE TABLE "new_statuses" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "colorCode" TEXT NOT NULL DEFAULT '#666666',
    "isFinalState" BOOLEAN NOT NULL DEFAULT false,
    "visible_to_ai" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0
);
INSERT INTO "new_statuses" ("colorCode", "id", "isFinalState", "name", "order") SELECT "colorCode", "id", "isFinalState", "name", "order" FROM "statuses";
DROP TABLE "statuses";
ALTER TABLE "new_statuses" RENAME TO "statuses";
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
    "projectId" TEXT NOT NULL,
    "parentTaskId" TEXT,
    "statusId" TEXT NOT NULL,
    "priorityId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "tasks" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "statuses" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_priorityId_fkey" FOREIGN KEY ("priorityId") REFERENCES "priorities" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_tasks" ("assignedToId", "createdAt", "createdById", "deadline", "description", "id", "isCompleted", "parentTaskId", "position", "priorityId", "projectId", "statusId", "title", "updatedAt") SELECT "assignedToId", "createdAt", "createdById", "deadline", "description", "id", "isCompleted", "parentTaskId", "position", "priorityId", "projectId", "statusId", "title", "updatedAt" FROM "tasks";
DROP TABLE "tasks";
ALTER TABLE "new_tasks" RENAME TO "tasks";
CREATE TABLE "new_users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "email" TEXT,
    "avatarUrl" TEXT,
    "role" TEXT NOT NULL DEFAULT 'Viewer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_users" ("avatarUrl", "createdAt", "email", "id", "name", "role", "updatedAt") SELECT "avatarUrl", "createdAt", "email", "id", "name", "role", "updatedAt" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_nickname_key" ON "users"("nickname");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "task_execution_logs_taskId_idx" ON "task_execution_logs"("taskId");

-- CreateIndex
CREATE INDEX "task_execution_logs_startedAt_idx" ON "task_execution_logs"("startedAt");

-- CreateIndex
CREATE INDEX "task_execution_logs_userId_idx" ON "task_execution_logs"("userId");
