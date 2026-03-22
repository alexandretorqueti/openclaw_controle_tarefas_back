
// Tipos para Prisma Client
import { PrismaClient } from '@prisma/client';

// Declaração global para o Prisma Client
declare global {
  var prisma: PrismaClient | undefined;
}

// Extensão do objeto Error
interface Error {
  statusCode?: number;
  errors?: any;
}

export {};
