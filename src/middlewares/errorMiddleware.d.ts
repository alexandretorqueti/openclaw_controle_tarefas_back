declare const Logger: any, ERROR_TYPES: any;
declare const Prisma: any;
declare const autoTaskService: any;
/**
 * Global error handling middleware for Express.js
 * Captures all errors and logs them to the database
 */
declare class ErrorMiddleware {
    /**
     * Get the error type based on the error instance
     * @param {Error} error - Error object
     * @returns {string} Error type
     */
    static getErrorType(error: any): any;
    /**
     * Get appropriate HTTP status code for the error
     * @param {Error} error - Error object
     * @returns {number} HTTP status code
     */
    static getStatusCode(error: any): any;
    /**
     * Get user-friendly error message
     * @param {Error} error - Error object
     * @param {string} errorType - Error type
     * @returns {string} User-friendly message
     */
    static getUserFriendlyMessage(error: any, errorType: any): string;
    /**
     * Generate a correlation ID for request tracing
     * @returns {string} Correlation ID
     */
    static generateCorrelationId(): any;
    /**
     * Middleware to add correlation ID to request
     */
    static addCorrelationId(req: any, res: any, next: any): void;
    /**
     * Middleware to log request start time
     */
    static logRequestStart(req: any, res: any, next: any): void;
    /**
     * Global error handler middleware
     */
    static handler(): (error: any, req: any, res: any, next: any) => Promise<void>;
    /**
     * 404 handler middleware
     */
    static notFoundHandler(): (req: any, res: any, next: any) => Promise<void>;
    /**
     * Async handler wrapper to catch async errors
     * @param {Function} fn - Async function to wrap
     * @returns {Function} Wrapped function
     */
    static catchAsync(fn: any): (req: any, res: any, next: any) => void;
}
