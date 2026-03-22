// src/utils/logger.ts (Arquitetura Refatorada - Worker Leve)

import { Request, Response } from 'express';
import prisma from '../services/prismaService';

/**
 * Log levels
 */
export enum LOG_LEVELS {
  ERROR = 'ERROR',
  WARN = 'WARN',
  INFO = 'INFO',
  DEBUG = 'DEBUG'
}

/**
 * Error types
 */
export enum ERROR_TYPES {
  VALIDATION = 'ValidationError',
  DATABASE = 'DatabaseError',
  BUSINESS = 'BusinessError',
  SYSTEM = 'SystemError',
  AUTH = 'AuthenticationError',
  NOT_FOUND = 'NotFoundError',
  FORBIDDEN = 'ForbiddenError',
  CAN_DECOMPOSE_ERROR = 'CanDecomposeError',
  SSE = 'SSE',
  DECOMPOSITION_ERROR = 'DecompositionError'
}

/**
 * Interfaces para tipagem rigorosa
 */
interface LogOptions {
  level?: LOG_LEVELS;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  message: string;
  errorType?: string;
  stackTrace?: string;
  requestBody?: any;
  requestQuery?: any;
  requestParams?: any;
  headers?: any;
  clientIp?: string;
  userId?: string | null;
  correlationId?: string | null;
  parentLogId?: string | null;
  responseTime?: number;
}

interface LogFilters {
  level?: LOG_LEVELS;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  errorType?: string;
  userId?: string;
  correlationId?: string;
  startDate?: string | Date;
  endDate?: string | Date;
  limit?: number;
  offset?: number;
}

// Extensão local para propriedades injetadas por middlewares
interface ExtendedRequest extends Request {
  _startTime?: number;
  user?: { id: string };
  correlationId?: string;
}

/**
 * Logger class for centralized error handling and logging
 */
export class Logger {
  /**
   * Create a log entry in the database
   */
  static async createLog(options: LogOptions): Promise<any> {
    try {
      const {
        level = LOG_LEVELS.ERROR,
        endpoint,
        method,
        statusCode,
        message,
        errorType,
        stackTrace,
        requestBody,
        requestQuery,
        requestParams,
        headers,
        clientIp,
        userId,
        correlationId,
        parentLogId,
        responseTime
      } = options;

      // Stringify objects for storage
      const stringifiedRequestBody = requestBody ? JSON.stringify(requestBody) : null;
      const stringifiedRequestQuery = requestQuery ? JSON.stringify(requestQuery) : null;
      const stringifiedRequestParams = requestParams ? JSON.stringify(requestParams) : null;
      const stringifiedHeaders = headers ? JSON.stringify(headers) : null;

      const log = await prisma.log.create({
        data: {
          timestamp: new Date(),
          level,
          endpoint: endpoint || null,
          method: method || null,
          statusCode: statusCode || null,
          message,
          errorType: errorType || null,
          stackTrace: stackTrace || null,
          requestBody: stringifiedRequestBody,
          requestQuery: stringifiedRequestQuery,
          requestParams: stringifiedRequestParams,
          headers: stringifiedHeaders,
          clientIp: clientIp || null,
          userId: userId || null,
          correlationId: correlationId || null,
          parentLogId: parentLogId || null,
          responseTime: responseTime || null
        }
      });

      // Console logging for development
      if (process.env.NODE_ENV === 'development') {
        const logMessage = `[${level}] ${method || 'LOG'} ${endpoint || ''} - ${statusCode || ''}: ${message}`;
        if (level === LOG_LEVELS.ERROR) {
          console.error(logMessage);
          if (stackTrace) console.error(stackTrace);
        } else if (level === LOG_LEVELS.WARN) {
          console.warn(logMessage);
        } else {
          console.log(logMessage);
        }
      }

      return log;
    } catch (error) {
      console.error('Failed to create log entry:', error);
      console.error('Original log data:', options);
      return null;
    }
  }

  /**
   * Log an error with full context
   */
  static async logError(
      error: any, 
      req: ExtendedRequest, 
      res: Response, 
      errorType = ERROR_TYPES.SYSTEM, correlationId: string | null = null
    ): Promise<any> {
    const clientIp = (req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString();
    
    return await Logger.createLog({
      level: LOG_LEVELS.ERROR,
      endpoint: req.originalUrl || req.url,
      method: req.method,
      statusCode: res.statusCode || 500,
      message: error.message || 'Unknown error',
      errorType,
      stackTrace: error.stack,
      requestBody: req.body,
      requestQuery: req.query,
      requestParams: req.params,
      headers: req.headers,
      clientIp,
      userId: req.user?.id || null,
      correlationId: correlationId || req.correlationId || null,
      responseTime: req._startTime ? Date.now() - req._startTime : 0
    });
  }

  static async logValidationError(validationError: any, req: ExtendedRequest, res: Response): Promise<any> {
    const error = new Error('Validation failed');
    (error as any).validationErrors = validationError.errors;
    return await Logger.logError(error, req, res, ERROR_TYPES.VALIDATION);
  }

  static async logDatabaseError(error: any, req: ExtendedRequest, res: Response): Promise<any> {
    return await Logger.logError(error, req, res, ERROR_TYPES.DATABASE);
  }

  static async logBusinessError(message: string, req: ExtendedRequest, res: Response): Promise<any> {
    const error = new Error(message);
    return await Logger.logError(error, req, res, ERROR_TYPES.BUSINESS);
  }

  static async logInfo(options: LogOptions): Promise<any> {
    return await Logger.createLog({
      level: LOG_LEVELS.INFO,
      ...options
    });
  }

  static async logWarning(options: LogOptions): Promise<any> {
    return await Logger.createLog({
      level: LOG_LEVELS.WARN,
      ...options
    });
  }

  /**
   * Get logs with filters
   */
  static async getLogs(filters: LogFilters = {}): Promise<any> {
    const {
      level,
      endpoint,
      method,
      statusCode,
      errorType,
      userId,
      correlationId,
      startDate,
      endDate,
      limit = 100,
      offset = 0
    } = filters;

    const where: any = {};

    if (level) where.level = level;
    if (endpoint) where.endpoint = { contains: endpoint };
    if (method) where.method = method;
    if (statusCode) where.statusCode = statusCode;
    if (errorType) where.errorType = errorType;
    if (userId) where.userId = userId;
    if (correlationId) where.correlationId = correlationId;
    
    if (startDate || endDate) {
      where.timestamp = {};
      if (startDate) where.timestamp.gte = new Date(startDate);
      if (endDate) where.timestamp.lte = new Date(endDate);
    }

    return await prisma.log.findMany({
      where,
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: limit,
      skip: offset
    });
  }

  static async getLogById(logId: string): Promise<any> {
    return await prisma.log.findUnique({
      where: { id: logId },
      include: {
        user: { select: { id: true, name: true, email: true } },
        childLogs: {
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });
  }

  /**
   * Generate a user-friendly error response
   */
  static formatErrorResponse(error: Error, logId: string, includeDetails = false) {
    const response: any = {
      error: 'An error occurred',
      logId,
      timestamp: new Date().toISOString()
    };

    if (includeDetails && process.env.NODE_ENV === 'development') {
      response.message = error.message;
      response.stack = error.stack;
    }

    return response;
  }
}

// Export default pattern compatível com o sistema atual
export default Logger;