var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { Logger, ERROR_TYPES } = require('../utils/logger');
const { Prisma } = require('@prisma/client');
const autoTaskService = require('../services/autoTaskService');
/**
 * Global error handling middleware for Express.js
 * Captures all errors and logs them to the database
 */
class ErrorMiddleware {
    /**
     * Get the error type based on the error instance
     * @param {Error} error - Error object
     * @returns {string} Error type
     */
    static getErrorType(error) {
        if (error.name === 'ZodError') {
            return ERROR_TYPES.VALIDATION;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            return ERROR_TYPES.DATABASE;
        }
        if (error instanceof Prisma.PrismaClientUnknownRequestError) {
            return ERROR_TYPES.DATABASE;
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return ERROR_TYPES.VALIDATION;
        }
        if (error.statusCode === 404) {
            return ERROR_TYPES.NOT_FOUND;
        }
        if (error.statusCode === 403 || error.statusCode === 401) {
            return error.statusCode === 403 ? ERROR_TYPES.FORBIDDEN : ERROR_TYPES.AUTH;
        }
        if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
            return ERROR_TYPES.BUSINESS;
        }
        return ERROR_TYPES.SYSTEM;
    }
    /**
     * Get appropriate HTTP status code for the error
     * @param {Error} error - Error object
     * @returns {number} HTTP status code
     */
    static getStatusCode(error) {
        if (error.statusCode) {
            return error.statusCode;
        }
        if (error.name === 'ZodError') {
            return 400;
        }
        if (error instanceof Prisma.PrismaClientKnownRequestError) {
            // Handle specific Prisma errors
            switch (error.code) {
                case 'P2002': // Unique constraint violation
                    return 409;
                case 'P2003': // Foreign key constraint violation
                case 'P2025': // Record not found
                    return 404;
                case 'P2016': // Query interpretation error
                case 'P2021': // Table does not exist
                    return 500;
                default:
                    return 400;
            }
        }
        if (error instanceof Prisma.PrismaClientValidationError) {
            return 400;
        }
        return 500;
    }
    /**
     * Get user-friendly error message
     * @param {Error} error - Error object
     * @param {string} errorType - Error type
     * @returns {string} User-friendly message
     */
    static getUserFriendlyMessage(error, errorType) {
        // Default message
        let message = 'An unexpected error occurred. Please try again later.';
        switch (errorType) {
            case ERROR_TYPES.VALIDATION:
                message = 'The provided data is invalid. Please check your input.';
                break;
            case ERROR_TYPES.DATABASE:
                if (error instanceof Prisma.PrismaClientKnownRequestError) {
                    switch (error.code) {
                        case 'P2002':
                            message = 'A record with this information already exists.';
                            break;
                        case 'P2003':
                            message = 'The referenced record does not exist.';
                            break;
                        case 'P2025':
                            message = 'The requested record was not found.';
                            break;
                        default:
                            message = 'A database error occurred. Please try again.';
                    }
                }
                else {
                    message = 'A database error occurred. Please try again.';
                }
                break;
            case ERROR_TYPES.BUSINESS:
                message = error.message || 'A business logic error occurred.';
                break;
            case ERROR_TYPES.NOT_FOUND:
                message = error.message || 'The requested resource was not found.';
                break;
            case ERROR_TYPES.AUTH:
                message = 'Authentication failed. Please check your credentials.';
                break;
            case ERROR_TYPES.FORBIDDEN:
                message = 'You do not have permission to perform this action.';
                break;
            case ERROR_TYPES.SYSTEM:
                message = 'A system error occurred. Our team has been notified.';
                break;
        }
        return message;
    }
    /**
     * Generate a correlation ID for request tracing
     * @returns {string} Correlation ID
     */
    static generateCorrelationId() {
        return require('crypto').randomUUID();
    }
    /**
     * Middleware to add correlation ID to request
     */
    static addCorrelationId(req, res, next) {
        req.correlationId = ErrorMiddleware.generateCorrelationId();
        res.setHeader('X-Correlation-ID', req.correlationId);
        next();
    }
    /**
     * Middleware to log request start time
     */
    static logRequestStart(req, res, next) {
        req._startTime = Date.now();
        next();
    }
    /**
     * Global error handler middleware
     */
    static handler() {
        return (error, req, res, next) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Get error details
                const errorType = ErrorMiddleware.getErrorType(error);
                const statusCode = ErrorMiddleware.getStatusCode(error);
                const userFriendlyMessage = ErrorMiddleware.getUserFriendlyMessage(error, errorType);
                // Set response status code
                res.status(statusCode);
                // Log the error to database (skip 404 errors in production)
                let logEntry = null;
                const shouldLog404 = process.env.NODE_ENV === 'development';
                if (errorType !== ERROR_TYPES.NOT_FOUND || shouldLog404) {
                    logEntry = yield Logger.logError(error, req, res, errorType, req.correlationId);
                }
                // Prepare response
                const response = {
                    error: userFriendlyMessage,
                    timestamp: new Date().toISOString()
                };
                // Add log ID for tracking if available
                if (logEntry && logEntry.id) {
                    response.logId = logEntry.id;
                    response.correlationId = req.correlationId;
                }
                // Add validation errors if present
                if (error.name === 'ZodError' && error.errors) {
                    response.validationErrors = error.errors.map(err => ({
                        field: err.path.join('.'),
                        message: err.message
                    }));
                }
                // Add Prisma error details in development
                if (process.env.NODE_ENV === 'development') {
                    response.debug = {
                        message: error.message,
                        type: errorType,
                        code: error.code,
                        meta: error.meta
                    };
                    if (error.stack) {
                        response.debug.stack = error.stack.split('\n').slice(0, 5).join('\n');
                    }
                }
                // Send response
                res.json(response);
                // Criar tarefa automática de forma assíncrona (não bloquear resposta)
                try {
                    autoTaskService.createAutoTask(error, req, res)
                        .then(task => {
                        if (task) {
                            console.log(`Tarefa automática ${task.id} criada para erro: ${error.message}`);
                        }
                    })
                        .catch(taskError => {
                        // Não falhar se a criação da tarefa falhar
                        console.error('Erro ao criar tarefa automática:', taskError.message);
                    });
                }
                catch (taskError) {
                    console.error('Erro ao iniciar criação de tarefa automática:', taskError.message);
                }
            }
            catch (loggingError) {
                // Fallback if logging fails
                console.error('Error logging failed:', loggingError);
                console.error('Original error:', error);
                res.status(500).json({
                    error: 'An internal server error occurred',
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    /**
     * 404 handler middleware
     */
    static notFoundHandler() {
        return (req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
            error.statusCode = 404;
            // Log 404 errors only in development
            if (process.env.NODE_ENV === 'development') {
                yield Logger.logError(error, req, res, ERROR_TYPES.NOT_FOUND, req.correlationId);
            }
            res.status(404).json({
                error: 'The requested resource was not found',
                path: req.originalUrl,
                method: req.method,
                timestamp: new Date().toISOString(),
                correlationId: req.correlationId
            });
        });
    }
    /**
     * Async handler wrapper to catch async errors
     * @param {Function} fn - Async function to wrap
     * @returns {Function} Wrapped function
     */
    static catchAsync(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }
}
module.exports = ErrorMiddleware;
