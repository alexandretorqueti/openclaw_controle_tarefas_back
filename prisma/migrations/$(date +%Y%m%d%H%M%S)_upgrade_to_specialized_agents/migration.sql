-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "domain" TEXT;
ALTER TABLE "tasks" ADD COLUMN "isDecomposed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN "isAtomic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "projects" RENAME COLUMN "programadorContratado" TO "programadorFront";
ALTER TABLE "projects" ADD COLUMN "programadorBack" TEXT;