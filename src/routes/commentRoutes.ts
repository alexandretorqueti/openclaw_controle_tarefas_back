import express from 'express';
const commentController = require('../controllers/commentController';');

const router = express.Router();

// POST /api/comments - Create new comment
router.post('/', commentController.createComment);

// GET /api/comments/task/:taskId - Get all comments for a task
router.get('/task/:taskId', commentController.getCommentsByTask);

// GET /api/comments/:id - Get comment by ID
router.get('/:id', commentController.getCommentById);

// PUT /api/comments/:id - Update comment
router.put('/:id', commentController.updateComment);

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', commentController.deleteComment);

// GET /api/comments/:commentId/replies - Get replies for a comment
router.get('/:commentId/replies', commentController.getCommentReplies);

module.exports = router;