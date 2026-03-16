-- CreateTable
CREATE TABLE "stages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "etapa" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "stages_etapa_key" ON "stages"("etapa");
