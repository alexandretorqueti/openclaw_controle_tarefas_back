// src/routes/taskHistoryRoutes.jsimport express from 'express');
const taskHistoryController = require('../controllers/taskHistoryController';

const router = express.Router();

// GET /api/task-history/task/:taskId - Get all history records for a task
router.get('/task/:taskId', taskHistoryController.getHistoryByTask);

// GET /api/task-history/:id - Get history record by ID
router.get('/:id', taskHistoryController.getHistoryById);

// POST /api/task-history - Create new history record
router.post('/', taskHistoryController.createHistory);

// DELETE /api/task-history/:id - Delete history record
router.delete('/:id', taskHistoryController.deleteHistory);

module.exports = router;
