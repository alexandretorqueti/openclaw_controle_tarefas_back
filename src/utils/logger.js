// logger.js (Arquitetura Refatorada - Worker Leve)
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const prisma = require('../services/prismaService');
/**
 * Log levels
 */
const LOG_LEVELS = {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG'
};
/**
 * Error types
 */
const ERROR_TYPES = {
    VALIDATION: 'ValidationError',
    DATABASE: 'DatabaseError',
    BUSINESS: 'BusinessError',
    SYSTEM: 'SystemError',
    AUTH: 'AuthenticationError',
    NOT_FOUND: 'NotFoundError',
    FORBIDDEN: 'ForbiddenError'
};
/**
 * Logger class for centralized error handling and logging
 */
class Logger {
    /**
     * Create a log entry in the database
     * @param {Object} options - Log options
     * @param {string} options.level - Log level (ERROR, WARN, INFO, DEBUG)
     * @param {string} options.endpoint - API endpoint
     * @param {string} options.method - HTTP method
     * @param {number} options.statusCode - HTTP status code
     * @param {string} options.message - Error message
     * @param {string} options.errorType - Type of error
     * @param {string} options.stackTrace - Stack trace
     * @param {Object} options.requestBody - Request body
     * @param {Object} options.requestQuery - Request query parameters
     * @param {Object} options.requestParams - Request path parameters
     * @param {Object} options.headers - Request headers
     * @param {string} options.clientIp - Client IP address
     * @param {string} options.userId - User ID (if authenticated)
     * @param {string} options.correlationId - Correlation ID for request tracing
     * @param {string} options.parentLogId - Parent log ID for hierarchical logging
     * @param {number} options.responseTime - Response time in milliseconds
     * @returns {Promise<Object>} Created log entry
     */
    static createLog(options) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { level = LOG_LEVELS.ERROR, endpoint, method, statusCode, message, errorType, stackTrace, requestBody, requestQuery, requestParams, headers, clientIp, userId, correlationId, parentLogId, responseTime } = options;
                // Stringify objects for storage
                const stringifiedRequestBody = requestBody ? JSON.stringify(requestBody) : null;
                const stringifiedRequestQuery = requestQuery ? JSON.stringify(requestQuery) : null;
                const stringifiedRequestParams = requestParams ? JSON.stringify(requestParams) : null;
                const stringifiedHeaders = headers ? JSON.stringify(headers) : null;
                const log = yield prisma.log.create({
                    data: {
                        timestamp: new Date(),
                        level,
                        endpoint,
                        method,
                        statusCode,
                        message,
                        errorType,
                        stackTrace,
                        requestBody: stringifiedRequestBody,
                        requestQuery: stringifiedRequestQuery,
                        requestParams: stringifiedRequestParams,
                        headers: stringifiedHeaders,
                        clientIp,
                        userId,
                        correlationId,
                        parentLogId,
                        responseTime
                    }
                });
                // Also log to console for development
                if (process.env.NODE_ENV === 'development') {
                    const logMessage = `[${level}] ${method} ${endpoint} - ${statusCode}: ${message}`;
                    if (level === LOG_LEVELS.ERROR) {
                        console.error(logMessage);
                        if (stackTrace)
                            console.error(stackTrace);
                    }
                    else if (level === LOG_LEVELS.WARN) {
                        console.warn(logMessage);
                    }
                    else {
                        console.log(logMessage);
                    }
                }
                return log;
            }
            catch (error) {
                // Fallback to console if database logging fails
                console.error('Failed to create log entry:', error);
                console.error('Original log data:', options);
                return null;
            }
        });
    }
    /**
     * Log an error with full context
     * @param {Error} error - Error object
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} errorType - Type of error
     * @param {string} correlationId - Correlation ID
     * @returns {Promise<Object>} Created log entry
     */
    static logError(error, req, res, errorType = ERROR_TYPES.SYSTEM, correlationId = null) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const clientIp = req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            return yield Logger.createLog({
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
                userId: ((_a = req.user) === null || _a === void 0 ? void 0 : _a.id) || null,
                correlationId,
                responseTime: Date.now() - (req._startTime || Date.now())
            });
        });
    }
    /**
     * Log a validation error
     * @param {Object} validationError - Zod validation error
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logValidationError(validationError, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const error = new Error('Validation failed');
            error.validationErrors = validationError.errors;
            return yield Logger.logError(error, req, res, ERROR_TYPES.VALIDATION);
        });
    }
    /**
     * Log a database error
     * @param {Error} error - Database error
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logDatabaseError(error, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Logger.logError(error, req, res, ERROR_TYPES.DATABASE);
        });
    }
    /**
     * Log a business logic error
     * @param {string} message - Error message
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logBusinessError(message, req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const error = new Error(message);
            return yield Logger.logError(error, req, res, ERROR_TYPES.BUSINESS);
        });
    }
    /**
     * Log informational message
     * @param {Object} options - Log options
     * @returns {Promise<Object>} Created log entry
     */
    static logInfo(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Logger.createLog(Object.assign({ level: LOG_LEVELS.INFO }, options));
        });
    }
    /**
     * Log warning message
     * @param {Object} options - Log options
     * @returns {Promise<Object>} Created log entry
     */
    static logWarning(options) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield Logger.createLog(Object.assign({ level: LOG_LEVELS.WARN }, options));
        });
    }
    /**
     * Get logs with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of logs
     */
    static getLogs(filters = {}) {
        return __awaiter(this, void 0, void 0, function* () {
            const { level, endpoint, method, statusCode, errorType, userId, correlationId, startDate, endDate, limit = 100, offset = 0 } = filters;
            const where = {};
            if (level)
                where.level = level;
            if (endpoint)
                where.endpoint = { contains: endpoint };
            if (method)
                where.method = method;
            if (statusCode)
                where.statusCode = statusCode;
            if (errorType)
                where.errorType = errorType;
            if (userId)
                where.userId = userId;
            if (correlationId)
                where.correlationId = correlationId;
            if (startDate || endDate) {
                where.timestamp = {};
                if (startDate)
                    where.timestamp.gte = new Date(startDate);
                if (endDate)
                    where.timestamp.lte = new Date(endDate);
            }
            return yield prisma.log.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    }
                },
                orderBy: {
                    timestamp: 'desc'
                },
                take: limit,
                skip: offset
            });
        });
    }
    /**
     * Get log by ID
     * @param {string} logId - Log ID
     * @returns {Promise<Object>} Log entry
     */
    static getLogById(logId) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield prisma.log.findUnique({
                where: { id: logId },
                include: {
                    user: {
                        select: {
                            id: true,
                            name: true,
                            email: true
                        }
                    },
                    childLogs: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true
                                }
                            }
                        }
                    }
                }
            });
        });
    }
    /**
     * Generate a user-friendly error response with log ID
     * @param {Error} error - Error object
     * @param {string} logId - Log ID for tracking
     * @param {boolean} includeDetails - Whether to include error details
     * @returns {Object} Formatted error response
     */
    static formatErrorResponse(error, logId, includeDetails = false) {
        const response = {
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
module.exports = {
    Logger,
    LOG_LEVELS,
    ERROR_TYPES
};
