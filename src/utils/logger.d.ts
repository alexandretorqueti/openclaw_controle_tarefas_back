declare const prisma: any;
/**
 * Log levels
 */
declare const LOG_LEVELS: {
    ERROR: string;
    WARN: string;
    INFO: string;
    DEBUG: string;
};
/**
 * Error types
 */
declare const ERROR_TYPES: {
    VALIDATION: string;
    DATABASE: string;
    BUSINESS: string;
    SYSTEM: string;
    AUTH: string;
    NOT_FOUND: string;
    FORBIDDEN: string;
};
/**
 * Logger class for centralized error handling and logging
 */
declare class Logger {
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
    static createLog(options: any): Promise<any>;
    /**
     * Log an error with full context
     * @param {Error} error - Error object
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @param {string} errorType - Type of error
     * @param {string} correlationId - Correlation ID
     * @returns {Promise<Object>} Created log entry
     */
    static logError(error: any, req: any, res: any, errorType?: any, correlationId?: any): Promise<any>;
    /**
     * Log a validation error
     * @param {Object} validationError - Zod validation error
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logValidationError(validationError: any, req: any, res: any): Promise<any>;
    /**
     * Log a database error
     * @param {Error} error - Database error
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logDatabaseError(error: any, req: any, res: any): Promise<any>;
    /**
     * Log a business logic error
     * @param {string} message - Error message
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     * @returns {Promise<Object>} Created log entry
     */
    static logBusinessError(message: any, req: any, res: any): Promise<any>;
    /**
     * Log informational message
     * @param {Object} options - Log options
     * @returns {Promise<Object>} Created log entry
     */
    static logInfo(options: any): Promise<any>;
    /**
     * Log warning message
     * @param {Object} options - Log options
     * @returns {Promise<Object>} Created log entry
     */
    static logWarning(options: any): Promise<any>;
    /**
     * Get logs with filters
     * @param {Object} filters - Filter options
     * @returns {Promise<Array>} Array of logs
     */
    static getLogs(filters?: {}): Promise<any>;
    /**
     * Get log by ID
     * @param {string} logId - Log ID
     * @returns {Promise<Object>} Log entry
     */
    static getLogById(logId: any): Promise<any>;
    /**
     * Generate a user-friendly error response with log ID
     * @param {Error} error - Error object
     * @param {string} logId - Log ID for tracking
     * @param {boolean} includeDetails - Whether to include error details
     * @returns {Object} Formatted error response
     */
    static formatErrorResponse(error: any, logId: any, includeDetails?: boolean): {
        error: string;
        logId: any;
        timestamp: string;
    };
}
