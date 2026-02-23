const commentService = require('../services/commentService');
const { validateComment, validateCommentUpdate } = require('../validators/commentValidator');

// Helper function to convert snake_case to camelCase
function snakeToCamel(obj) {
  if (Array.isArray(obj)) {
    return obj.map(item => snakeToCamel(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const newObj = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
        newObj[camelKey] = snakeToCamel(obj[key]);
      }
    }
    return newObj;
  }
  
  return obj;
}

class CommentController {
  // Create a new comment
  async createComment(req, res, next) {
    try {
      // Convert snake_case to camelCase if needed
      const body = snakeToCamel(req.body);
      
      const validation = validateComment(body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      const comment = await commentService.createComment(validation.data);
      
      res.status(201).json({
        message: 'Comment created successfully',
        comment
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all comments for a task
  async getCommentsByTask(req, res, next) {
    try {
      const { taskId } = req.params;
      const comments = await commentService.getCommentsByTask(taskId);
      
      res.json({
        count: comments.length,
        comments
      });
    } catch (error) {
      next(error);
    }
  }

  // Get comment by ID
  async getCommentById(req, res, next) {
    try {
      const { id } = req.params;
      const comment = await commentService.getCommentById(id);
      
      if (!comment) {
        return res.status(404).json({
          error: 'Comment not found'
        });
      }
      
      res.json(comment);
    } catch (error) {
      next(error);
    }
  }

  // Update comment
  async updateComment(req, res, next) {
    try {
      const { id } = req.params;
      const validation = validateCommentUpdate(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      // Check if comment exists
      const existingComment = await commentService.getCommentById(id);
      if (!existingComment) {
        return res.status(404).json({
          error: 'Comment not found'
        });
      }

      // TODO: Add authorization check - only comment owner can update
      // For now, we'll allow any update

      const updatedComment = await commentService.updateComment(id, validation.data);
      
      res.json({
        message: 'Comment updated successfully',
        comment: updatedComment
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete comment
  async deleteComment(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if comment exists
      const existingComment = await commentService.getCommentById(id);
      if (!existingComment) {
        return res.status(404).json({
          error: 'Comment not found'
        });
      }

      // TODO: Add authorization check - only comment owner can delete
      // For now, we'll allow any deletion

      await commentService.deleteComment(id);
      
      res.json({
        message: 'Comment deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Get replies for a comment
  async getCommentReplies(req, res, next) {
    try {
      const { commentId } = req.params;
      const replies = await commentService.getCommentReplies(commentId);
      
      res.json({
        count: replies.length,
        replies
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CommentController();