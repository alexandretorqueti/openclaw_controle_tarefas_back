// src/controllers/logController.js

const fs = require('fs');
const path = require('path');
const { LOG_FILE } = require('../aux/config');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const { Logger } = require('../utils/logger');

class LogController {
  // Get monitor logs
  getMonitorLogs = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
      // Check if log file exists
      if (!fs.existsSync(LOG_FILE)) {
        return res.status(200).json({
          message: 'Log file does not exist',
          logs: [],
          count: 0,
          lastUpdated: null,
          correlationId: req.correlationId
        });
      }

      // Read the log file
      const logContent = fs.readFileSync(LOG_FILE, 'utf8');
      
      // Split by newlines and filter out empty lines
      const logs = logContent.split('\n').filter(line => line.trim() !== '');
      
      // Get file stats for last updated time
      const stats = fs.statSync(LOG_FILE);
      
      res.status(200).json({
        message: 'Logs retrieved successfully',
        logs,
        count: logs.length,
        lastUpdated: stats.mtime.toISOString(),
        fileSize: stats.size,
        correlationId: req.correlationId
      });
    } catch (error) {
      // If there's an error reading the file, return empty array
      console.error('Error reading log file:', error);
      
      res.status(200).json({
        message: 'Error reading log file, returning empty logs',
        logs: [],
        count: 0,
        lastUpdated: null,
        correlationId: req.correlationId
      });
    }
  });

  // Get error logs from database
  getErrorLogs = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
      const { startDate, endDate, limit = 100, offset = 0 } = req.query;
      
      // Default to today if no date range provided
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const logs = await Logger.getLogs({
        level: 'ERROR',
        startDate: startDate || today.toISOString(),
        endDate: endDate || tomorrow.toISOString(),
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.status(200).json({
        message: 'Error logs retrieved successfully',
        logs,
        count: logs.length,
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    } catch (error) {
      console.error('Error fetching error logs:', error);
      next(error);
    }
  });

  // Get all logs (with filters)
  getAllLogs = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
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
      } = req.query;

      const logs = await Logger.getLogs({
        level,
        endpoint,
        method,
        statusCode: statusCode ? parseInt(statusCode) : undefined,
        errorType,
        userId,
        correlationId,
        startDate,
        endDate,
        limit: parseInt(limit),
        offset: parseInt(offset)
      });

      res.status(200).json({
        message: 'Logs retrieved successfully',
        logs,
        count: logs.length,
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId
      });
    } catch (error) {
      console.error('Error fetching logs:', error);
      next(error);
    }
  });

  // Get log by ID
  getLogById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
      const { id } = req.params;
      const log = await Logger.getLogById(id);

      if (!log) {
        return res.status(404).json({
          error: 'Log not found',
          correlationId: req.correlationId
        });
      }

      res.status(200).json({
        message: 'Log retrieved successfully',
        log,
        correlationId: req.correlationId
      });
    } catch (error) {
      console.error('Error fetching log by ID:', error);
      next(error);
    }
  });

  // Get error details with formatted data
  getErrorDetails = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
      const { id } = req.params;
      const log = await Logger.getLogById(id);

      if (!log) {
        return res.status(404).json({
          error: 'Log not found',
          correlationId: req.correlationId
        });
      }

      // Parse JSON fields for easier consumption
      const formattedLog = {
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        endpoint: log.endpoint,
        method: log.method,
        statusCode: log.statusCode,
        message: log.message,
        errorType: log.errorType,
        stackTrace: log.stackTrace,
        
        // Parsed JSON fields
        requestBody: log.requestBody ? safeJsonParse(log.requestBody) : null,
        requestQuery: log.requestQuery ? safeJsonParse(log.requestQuery) : null,
        requestParams: log.requestParams ? safeJsonParse(log.requestParams) : null,
        headers: log.headers ? safeJsonParse(log.headers) : null,
        
        clientIp: log.clientIp,
        correlationId: log.correlationId,
        responseTime: log.responseTime,
        
        // User information
        user: log.user,
        
        // Related logs
        childLogs: log.childLogs?.map(child => ({
          id: child.id,
          timestamp: child.timestamp,
          level: child.level,
          message: child.message,
          errorType: child.errorType,
          user: child.user
        })) || []
      };

      res.status(200).json({
        message: 'Error details retrieved successfully',
        error: formattedLog,
        correlationId: req.correlationId
      });
    } catch (error) {
      console.error('Error fetching error details:', error);
      next(error);
    }
  });
}

// Helper function to safely parse JSON
function safeJsonParse(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    return { raw: jsonString, parseError: error.message };
  }
}

module.exports = new LogController();
