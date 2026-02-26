// src/routes/logRoutes.js

const express = require('express');
const router = express.Router();
const logController = require('../controllers/logController');

// GET /api/logs/monitor - Get monitor logs
router.get('/monitor', logController.getMonitorLogs);

module.exports = router;