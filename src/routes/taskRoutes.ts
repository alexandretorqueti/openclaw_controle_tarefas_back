import express from 'express';
import taskController from '../controllers/taskController';

const router = express.Router();

// GET /api/tasks - Get all tasks with filters
router.get('/', taskController.getAllTasks);

// GET /api/tasks/next/:nickname - Get the next priority task for a specific user
router.get('/next/:nickname', taskController.getNextTaskForUser);

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

// PATCH /api/tasks/:id/finalize - Finalize task (mark as final status)
router.patch('/:id/finalize', taskController.finalizeTask);

// PUT /api/tasks/:id/finish-execution - Finish task execution (set isExecuting to false)
router.put('/:id/finish-execution', taskController.finishTaskExecution);

export default router;
