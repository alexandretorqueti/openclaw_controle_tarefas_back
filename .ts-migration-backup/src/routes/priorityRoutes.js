const express = require('express');
const router = express.Router();
const priorityController = require('../controllers/priorityController');

// GET /api/priorities - Get all priorities
router.get('/', priorityController.getAllPriorities);

// GET /api/priorities/:id - Get priority by ID
router.get('/:id', priorityController.getPriorityById);

// POST /api/priorities - Create a new priority
router.post('/', priorityController.createPriority);

// PUT /api/priorities/:id - Update priority
router.put('/:id', priorityController.updatePriority);

// DELETE /api/priorities/:id - Delete priority
router.delete('/:id', priorityController.deletePriority);

module.exports = router;