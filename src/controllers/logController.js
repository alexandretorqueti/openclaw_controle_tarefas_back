// src/controllers/logController.js

const fs = require('fs');
const path = require('path');
const { LOG_FILE } = require('../../aux/config');
const ErrorMiddleware = require('../middlewares/errorMiddleware');

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
}

module.exports = new LogController();