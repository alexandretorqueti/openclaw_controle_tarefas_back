const ErrorMiddleware = require('../src/middlewares/errorMiddleware');
const { ERROR_TYPES } = require('../src/utils/logger');
const { Prisma } = require('@prisma/client');

describe('ErrorMiddleware', () => {
  describe('getErrorType', () => {
    it('should identify Zod validation errors', () => {
      const error = { name: 'ZodError' };
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.VALIDATION);
    });

    it('should identify Prisma database errors', () => {
      const error = new Prisma.PrismaClientKnownRequestError('Test', {
        code: 'P2002',
        clientVersion: 'test'
      });
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.DATABASE);
    });

    it('should identify not found errors', () => {
      const error = { statusCode: 404 };
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.NOT_FOUND);
    });

    it('should identify authentication errors', () => {
      const error = { statusCode: 401 };
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.AUTH);
    });

    it('should identify forbidden errors', () => {
      const error = { statusCode: 403 };
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.FORBIDDEN);
    });

    it('should identify business errors', () => {
      const error = { statusCode: 400 };
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.BUSINESS);
    });

    it('should default to system error', () => {
      const error = new Error('Unknown error');
      const errorType = ErrorMiddleware.getErrorType(error);
      expect(errorType).toBe(ERROR_TYPES.SYSTEM);
    });
  });

  describe('getStatusCode', () => {
    it('should return error status code if present', () => {
      const error = { statusCode: 404 };
      const statusCode = ErrorMiddleware.getStatusCode(error);
      expect(statusCode).toBe(404);
    });

    it('should return 400 for Zod errors', () => {
      const error = { name: 'ZodError' };
      const statusCode = ErrorMiddleware.getStatusCode(error);
      expect(statusCode).toBe(400);
    });

    it('should return appropriate codes for Prisma errors', () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: 'test'
      });
      expect(ErrorMiddleware.getStatusCode(uniqueError)).toBe(409);

      const fkError = new Prisma.PrismaClientKnownRequestError('FK constraint', {
        code: 'P2003',
        clientVersion: 'test'
      });
      expect(ErrorMiddleware.getStatusCode(fkError)).toBe(404);

      const notFoundError = new Prisma.PrismaClientKnownRequestError('Not found', {
        code: 'P2025',
        clientVersion: 'test'
      });
      expect(ErrorMiddleware.getStatusCode(notFoundError)).toBe(404);
    });

    it('should return 500 for unknown errors', () => {
      const error = new Error('Unknown');
      const statusCode = ErrorMiddleware.getStatusCode(error);
      expect(statusCode).toBe(500);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('should return validation error message', () => {
      const error = { name: 'ZodError' };
      const message = ErrorMiddleware.getUserFriendlyMessage(error, ERROR_TYPES.VALIDATION);
      expect(message).toBe('The provided data is invalid. Please check your input.');
    });

    it('should return database error messages', () => {
      const uniqueError = new Prisma.PrismaClientKnownRequestError('Unique', {
        code: 'P2002',
        clientVersion: 'test'
      });
      const uniqueMessage = ErrorMiddleware.getUserFriendlyMessage(uniqueError, ERROR_TYPES.DATABASE);
      expect(uniqueMessage).toBe('A record with this information already exists.');

      const fkError = new Prisma.PrismaClientKnownRequestError('FK', {
        code: 'P2003',
        clientVersion: 'test'
      });
      const fkMessage = ErrorMiddleware.getUserFriendlyMessage(fkError, ERROR_TYPES.DATABASE);
      expect(fkMessage).toBe('The referenced record does not exist.');
    });

    it('should return business error message', () => {
      const error = { message: 'Business rule violation' };
      const message = ErrorMiddleware.getUserFriendlyMessage(error, ERROR_TYPES.BUSINESS);
      expect(message).toBe('Business rule violation');
    });

    it('should return not found message', () => {
      const error = { message: 'Resource not found' };
      const message = ErrorMiddleware.getUserFriendlyMessage(error, ERROR_TYPES.NOT_FOUND);
      expect(message).toBe('Resource not found');
    });

    it('should return system error message', () => {
      const error = new Error('System failure');
      const message = ErrorMiddleware.getUserFriendlyMessage(error, ERROR_TYPES.SYSTEM);
      expect(message).toBe('A system error occurred. Our team has been notified.');
    });
  });

  describe('generateCorrelationId', () => {
    it('should generate a UUID correlation ID', () => {
      const correlationId = ErrorMiddleware.generateCorrelationId();
      expect(correlationId).toBeDefined();
      expect(typeof correlationId).toBe('string');
      // UUID pattern: 8-4-4-4-12 hex digits
      expect(correlationId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });

    it('should generate unique correlation IDs', () => {
      const id1 = ErrorMiddleware.generateCorrelationId();
      const id2 = ErrorMiddleware.generateCorrelationId();
      expect(id1).not.toBe(id2);
    });
  });

  describe('catchAsync', () => {
    it('should catch async errors and pass to next', async () => {
      const mockReq = {};
      const mockRes = {};
      const mockNext = jest.fn();
      
      const asyncFn = async () => {
        throw new Error('Async error');
      };
      
      const wrappedFn = ErrorMiddleware.catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
      expect(mockNext.mock.calls[0][0].message).toBe('Async error');
    });

    it('should pass through successful async functions', async () => {
      const mockReq = {};
      const mockRes = { json: jest.fn() };
      const mockNext = jest.fn();
      
      const asyncFn = async (req, res) => {
        res.json({ success: true });
      };
      
      const wrappedFn = ErrorMiddleware.catchAsync(asyncFn);
      await wrappedFn(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith({ success: true });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});