// Migrado para TypeScript - Fase: Controllers
// Arquivo: commentController.js

// CommentController.js

import commentService from '../services/commentService';
import { validateComment, validateCommentUpdate } from '../validators/commentValidator';
import { snakeToCamel } from '../utils/caseConverter';
import ErrorMiddleware from '../middlewares/errorMiddleware';
import prisma from '../services/prismaService';
import UserResolver from '../utils/userResolver';

class CommentController {
  // Create a new comment
  createComment = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    console.log('[DEBUG Backend createComment] Body completo:', req.body);
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
            (error as any).statusCode = 400;
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
      console.log('[DEBUG Backend] Body completo:', JSON.stringify(body));
      console.log('[DEBUG Backend] taskId:', body.taskId, 'task_id:', body.task_id);
      const taskId = body.taskId || body.task_id;
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
        (error as any).errors = validation.error.errors;
        (error as any).statusCode = 400;
        throw error;
      }

      const comment = await commentService.createComment(validation.data);
      
      res.status(201).json({
        message: 'Comment created successfully',
        comment,
        correlationId: req.correlationId
      });
    } catch (error) {
      // Tratar erros específicos de "not found" para retornar 404
      if (error.message && error.message.includes('not found')) {
        // Entidade não encontrada - retornar 404
        return res.status(404).json({
          success: false,
          error: error.message,
          message: 'Resource not found',
          correlationId: req.correlationId
        });
      }
      
      // Outros erros - passar para o error middleware
      next(error);
    }
  });

  // Get all comments for a task
  getCommentsByTask = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { taskId } = req.params;
    const comments = await commentService.getCommentsByTask(taskId);
    
    res.json({
      count: comments.length,
      comments,
      correlationId: req.correlationId
    });
  });

  // Get comment by ID
  getCommentById = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const comment = await commentService.getCommentById(id);

    if (!comment) {
      const error = new Error('Comment not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      comment,
      correlationId: req.correlationId
    });
  });

  // Update comment
  updateComment = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const validation = validateCommentUpdate(req.body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      (error as any).errors = validation.error.errors;
      (error as any).statusCode = 400;
      throw error;
    }

    const comment = await commentService.updateComment(id, validation.data);

    if (!comment) {
      const error = new Error('Comment not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Comment updated successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Delete comment
  deleteComment = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const comment = await commentService.deleteComment(id);

    if (!comment) {
      const error = new Error('Comment not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Comment deleted successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Get comments by user ID
  getCommentsByUserId = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { userId } = req.params;
    // Note: This would need to be implemented in commentService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Search comments
  searchComments = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { q } = req.query;
    
    if (!q || q.trim() === '') {
      const error = new Error('Search query is required');
      (error as any).statusCode = 400;
      throw error;
    }

    // Note: This would need to be implemented in commentService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get replies for a comment
  getCommentReplies = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { commentId } = req.params;
    const replies = await commentService.getCommentReplies(commentId);
    
    res.json({
      count: replies.length,
      replies,
      correlationId: req.correlationId
    });
  });
}

export default new CommentController();
