// Migrado para TypeScript - Fase: Services
// Arquivo: prismaService.js

import { PrismaClient } from '@prisma/client';

const getDatabaseUrl = (): any => {
  if (process.env.NODE_ENV === 'test') {
    // Usar banco em memória para testes
    return process.env.DATABASE_URL || 'file:test.db?mode=memory&cache=shared';
  }
  return process.env.DATABASE_URL || 'file:./prisma/dev.db';
};

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: getDatabaseUrl(),
    },
  },
  log: process.env.NODE_ENV === 'test' ? [] : (process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']),
});

export default prisma;