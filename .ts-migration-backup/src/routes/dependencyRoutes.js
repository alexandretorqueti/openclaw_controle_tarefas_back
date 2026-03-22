// src/routes/dependencyRoutes.js

const express = require('express');
const router = express.Router();
const dependencyController = require('../controllers/dependencyController');

// Create a new dependency
router.post('/', dependencyController.createDependency);

// Delete a dependency
router.delete('/:taskId/:dependentTaskId', dependencyController.deleteDependency);

// Get dependencies for a task
router.get('/task/:taskId', dependencyController.getTaskDependencies);

module.exports = router;