// CommentController.js

const commentService = require('../services/commentService');
const { validateComment, validateCommentUpdate } = require('../validators/commentValidator');
const { snakeToCamel } = require('../utils/caseConverter');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');
const UserResolver = require('../utils/userResolver');

class CommentController {
  // Create a new comment
  createComment = ErrorMiddleware.catchAsync(async (req, res, next) => {
    try {
      // Use req.body directly
      const body = req.body || {};
      
      // Get userId from body or req.user
      let userId = body.userId;
      
      // Check if req.user exists and has id
      if (req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // If still no userId, use default user
      if (!userId || userId.trim() === '') {
        try {
          // Usar o helper UserResolver para obter ID do usuário padrão
          const defaultUserId = await UserResolver.getDefaultUserId();
          
          if (defaultUserId) {
            userId = defaultUserId;
            console.log(`Usando usuário padrão para criação de comentário: ${defaultUserId}`);
          } else {
            // Se não houver usuários, retornar erro
            const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
            error.statusCode = 400;
            throw error;
          }
        } catch (error) {
          console.error('Erro ao buscar usuário padrão:', error.message);
          // Não usar mais ID fixo - retornar erro
          const fallbackError = new Error('Não foi possível determinar o usuário para criar o comentário. Certifique-se de que existem usuários no sistema.');
          fallbackError.statusCode = 400;
          throw fallbackError;
        }
      }
      
      // Prepare data for validation
      const dataForValidation = {
        content: body.content,
        taskId: body.taskId,
        userId: userId,
        parentCommentId: body.parentCommentId
      };
      
      const validation = validateComment(dataForValidation);
      
      if (!validation.success) {
        const error = new Error('Validation failed');
        error.name = 'ZodError';
        error.errors = validation.error.errors;
        error.statusCode = 400;
        throw error;
      }

      const comment = await commentService.createComment(validation.data);
      
      res.status(201).json({
        message: 'Comment created successfully',
        comment,
        correlationId: req.correlationId
      });
    } catch (error) {
      next(error);
    }
  });

  // Get all comments for a task
  getCommentsByTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    const comments = await commentService.getCommentsByTask(taskId);
    
    res.json({
      count: comments.length,
      comments,
      correlationId: req.correlationId
    });
  });

  // Get comment by ID
  getCommentById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const comment = await commentService.getCommentById(id);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      comment,
      correlationId: req.correlationId
    });
  });

  // Update comment
  updateComment = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const validation = validateCommentUpdate(req.body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const comment = await commentService.updateComment(id, validation.data);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Comment updated successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Delete comment
  deleteComment = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const comment = await commentService.deleteComment(id);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Comment deleted successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Get comments by user ID
  getCommentsByUserId = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { userId } = req.params;
    // Note: This would need to be implemented in commentService
    const error = new Error('Method not implemented yet');
    error.statusCode = 501;
    throw error;
  });

  // Search comments
  searchComments = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      const error = new Error('Search query is required');
      error.statusCode = 400;
      throw error;
    }

    // Note: This would need to be implemented in commentService
    const error = new Error('Method not implemented yet');
    error.statusCode = 501;
    throw error;
  });

  // Get replies for a comment
  getCommentReplies = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { commentId } = req.params;
    const replies = await commentService.getCommentReplies(commentId);
    
    res.json({
      count: replies.length,
      replies,
      correlationId: req.correlationId
    });
  });
}

module.exports = new CommentController();

