const express = require('express');
const router = express.Router();
const statusController = require('../controllers/statusController');

// GET /api/statuses - Get all statuses
router.get('/', statusController.getAllStatuses);

// GET /api/statuses/:id - Get status by ID
router.get('/:id', statusController.getStatusById);

// POST /api/statuses - Create a new status
router.post('/', statusController.createStatus);

// PUT /api/statuses/:id - Update status
router.put('/:id', statusController.updateStatus);

// DELETE /api/statuses/:id - Delete status
router.delete('/:id', statusController.deleteStatus);

module.exports = router;