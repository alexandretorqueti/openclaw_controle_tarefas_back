const { PrismaClient } = require('@prisma/client');

const getDatabaseUrl = () => {
  if (process.env.NODE_ENV === 'test') {
    return 'file:./prisma/test.db';
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