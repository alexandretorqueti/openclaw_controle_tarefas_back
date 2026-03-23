const express = require('express');
const projectController = require('../controllers/projectController');

const router = express.Router();

// GET /api/projects - Get all projects
router.get('/', projectController.getAllProjects);

// GET /api/projects/:id - Get project by ID
router.get('/:id', projectController.getProjectById);

// POST /api/projects - Create new project
router.post('/', projectController.createProject);

// PUT /api/projects/:id - Update project
router.put('/:id', projectController.updateProject);

// DELETE /api/projects/:id - Delete project (buttons fix 2026-03-10: frontend prevents task screen open)
router.delete('/:id', projectController.deleteProject);

// GET /api/projects/:id/statistics - Get project statistics
router.get('/:id/statistics', projectController.getProjectStatistics);

// GET /api/projects/:id/tasks - Get tasks by project (alias)
// Note: This endpoint is handled by taskController.getTasksByProject
// We'll create a separate route for this in taskRoutes

module.exports = router;