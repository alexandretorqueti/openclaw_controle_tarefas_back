// src/routes/logRoutes.js

const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// GET /api/logs/monitor - Get monitor logs
router.get('/monitor', logController.getMonitorLogs);

// GET /api/logs/errors - Get error logs from database
router.get('/errors', logController.getErrorLogs);

// GET /api/logs - Get all logs with filters
router.get('/', logController.getAllLogs);

// GET /api/logs/:id - Get log by ID
router.get('/:id', logController.getLogById);

module.exports = router;