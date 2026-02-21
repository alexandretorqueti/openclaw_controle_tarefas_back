const { Logger, LOG_LEVELS, ERROR_TYPES } = require('../src/utils/logger');

describe('Logger System', () => {

  describe('Logger.createLog', () => {
    it('should create an error log entry', async () => {
      const logData = {
        level: LOG_LEVELS.ERROR,
        endpoint: '/api/test',
        method: 'POST',
        statusCode: 500,
        message: 'Test error message',
        errorType: ERROR_TYPES.SYSTEM,
        stackTrace: 'Error: Test error\n    at test.js:1:1',
        requestBody: { test: 'data' },
        requestQuery: { param: 'value' },
        requestParams: { id: '123' },
        headers: { 'user-agent': 'test' },
        clientIp: '127.0.0.1',
        userId: 'test-user-id',
        correlationId: 'test-correlation-id',
        responseTime: 100
      };

      const log = await Logger.createLog(logData);

      expect(log).toBeDefined();
      expect(log.id).toBeDefined();
      expect(log.level).toBe(LOG_LEVELS.ERROR);
      expect(log.endpoint).toBe('/api/test');
      expect(log.method).toBe('POST');
      expect(log.statusCode).toBe(500);
      expect(log.message).toBe('Test error message');
      expect(log.errorType).toBe(ERROR_TYPES.SYSTEM);
      expect(log.correlationId).toBe('test-correlation-id');
    });

    it('should create an info log entry', async () => {
      const log = await Logger.createLog({
        level: LOG_LEVELS.INFO,
        endpoint: '/api/health',
        method: 'GET',
        statusCode: 200,
        message: 'Health check successful'
      });

      expect(log).toBeDefined();
      expect(log.level).toBe(LOG_LEVELS.INFO);
      expect(log.statusCode).toBe(200);
    });
  });

  describe('Logger.getLogs', () => {
    it('should retrieve logs with filters', async () => {
      const logs = await Logger.getLogs({
        level: LOG_LEVELS.ERROR,
        limit: 10
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should retrieve logs by date range', async () => {
      const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      const endDate = new Date();

      const logs = await Logger.getLogs({
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        limit: 5
      });

      expect(logs).toBeDefined();
      expect(Array.isArray(logs)).toBe(true);
    });
  });

  describe('Logger.getLogById', () => {
    it('should retrieve a log by ID', async () => {
      const retrievedLog = await Logger.getLogById('test-log-id');

      expect(retrievedLog).toBeDefined();
      expect(retrievedLog.id).toBeDefined();
      expect(retrievedLog.message).toBe('Not found test');
    });

    it('should return null for non-existent log ID', async () => {
      const log = await Logger.getLogById('non-existent-id');
      expect(log).toBeNull();
    });
  });

  describe('Logger.formatErrorResponse', () => {
    it('should format error response with log ID', () => {
      const error = new Error('Test error');
      const logId = 'test-log-id';
      
      const response = Logger.formatErrorResponse(error, logId, true);
      
      expect(response).toBeDefined();
      expect(response.error).toBe('An error occurred');
      expect(response.logId).toBe(logId);
      expect(response.timestamp).toBeDefined();
    });

    it('should include debug info in development', () => {
      const error = new Error('Test error');
      error.stack = 'Error stack trace';
      const logId = 'test-log-id';
      
      // Temporarily set NODE_ENV to development
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      
      const response = Logger.formatErrorResponse(error, logId, true);
      
      expect(response.message).toBe('Test error');
      expect(response.stack).toBe('Error stack trace');
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Error types and log levels', () => {
    it('should have correct error types', () => {
      expect(ERROR_TYPES.VALIDATION).toBe('ValidationError');
      expect(ERROR_TYPES.DATABASE).toBe('DatabaseError');
      expect(ERROR_TYPES.BUSINESS).toBe('BusinessError');
      expect(ERROR_TYPES.SYSTEM).toBe('SystemError');
    });

    it('should have correct log levels', () => {
      expect(LOG_LEVELS.ERROR).toBe('ERROR');
      expect(LOG_LEVELS.WARN).toBe('WARN');
      expect(LOG_LEVELS.INFO).toBe('INFO');
      expect(LOG_LEVELS.DEBUG).toBe('DEBUG');
    });
  });
});