// Setup for tests
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'file:./test.db';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

// Mock the prismaService module to avoid database connections in unit tests
jest.mock('../src/services/prismaService', () => {
  const mockLogs = {};
  
  return {
    log: {
      create: jest.fn().mockImplementation(({ data }) => {
        const id = data.id || 'test-log-id-' + Date.now();
        const log = {
          id,
          timestamp: data.timestamp || new Date(),
          level: data.level || 'ERROR',
          endpoint: data.endpoint || '/api/test',
          method: data.method || 'POST',
          statusCode: data.statusCode || 500,
          message: data.message || 'Test error',
          errorType: data.errorType || 'SystemError',
          correlationId: data.correlationId || 'test-correlation-id',
          ...data
        };
        mockLogs[id] = log;
        return Promise.resolve(log);
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'test-log-1',
          timestamp: new Date(),
          level: 'ERROR',
          endpoint: '/api/error',
          method: 'POST',
          statusCode: 400,
          message: 'Test error 1'
        },
        {
          id: 'test-log-2',
          timestamp: new Date(),
          level: 'WARN',
          endpoint: '/api/warn',
          method: 'GET',
          statusCode: 200,
          message: 'Test warning'
        }
      ]),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 'non-existent-id') {
          return null;
        }
        return Promise.resolve({
          id: where.id || 'test-log-id',
          timestamp: new Date(),
          level: 'ERROR',
          endpoint: '/api/test',
          method: 'GET',
          statusCode: 404,
          message: 'Not found test'
        });
      })
    }
  };
});