const { PrismaClient } = require('@prisma/client');

const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === 'test') {
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

module.exports = prisma;
// Garante que os modelos estão expostos para o JS legado
Object.assign(module.exports, prisma);
