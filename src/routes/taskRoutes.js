const express = require('express');
const taskController = require('../controllers/taskController');

const router = express.Router();

// GET /api/tasks - Get all tasks with filters
router.get('/', taskController.getAllTasks);

// GET /api/tasks/:id - Get task by ID
router.get('/:id', taskController.getTaskById);

// POST /api/tasks - Create new task
router.post('/', taskController.createTask);

// PUT /api/tasks/:id - Update task
router.put('/:id', taskController.updateTask);

// DELETE /api/tasks/:id - Delete task
router.delete('/:id', taskController.deleteTask);

// PATCH /api/tasks/:id/position - Update task position
router.patch('/:id/position', taskController.updateTaskPosition);

// PATCH /api/tasks/:id/toggle-completion - Toggle task completion
router.patch('/:id/toggle-completion', taskController.toggleTaskCompletion);

// GET /api/tasks/project/:projectId - Get tasks by project
router.get('/project/:projectId', taskController.getTasksByProject);

module.exports = router;