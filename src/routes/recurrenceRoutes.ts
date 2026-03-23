import express from 'express');
const router = express.Router();
const recurrenceController = require('../controllers/recurrenceController';

// Get recurring tasks that are due for execution
router.get('/due', recurrenceController.getRecurringTasksDue);

// Mark a specific task as executed
router.post('/:id/execute', recurrenceController.markTaskAsExecuted);

// Execute all due recurring tasks
router.post('/execute-all', recurrenceController.executeAllDueTasks);

// Calculate next execution for a task
router.get('/:id/next-execution', recurrenceController.calculateNextExecution);

module.exports = router;