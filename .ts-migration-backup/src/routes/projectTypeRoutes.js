const express = require('express');
const router = express.Router();
const projectTypeController = require('../controllers/projectTypeController');

// GET /api/project-types - Get all project types
router.get('/', projectTypeController.getAllProjectTypes);

// GET /api/project-types/:id - Get project type by ID
router.get('/:id', projectTypeController.getProjectTypeById);

// POST /api/project-types - Create a new project type
router.post('/', projectTypeController.createProjectType);

// PUT /api/project-types/:id - Update project type
router.put('/:id', projectTypeController.updateProjectType);

// DELETE /api/project-types/:id - Delete project type
router.delete('/:id', projectTypeController.deleteProjectType);

module.exports = router;