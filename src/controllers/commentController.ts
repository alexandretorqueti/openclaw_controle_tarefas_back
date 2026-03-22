// src/controllers/commentController.ts

import { Request, Response, NextFunction } from 'express';
import commentService from '../services/commentService';
import { validateComment, validateCommentUpdate } from '../validators/commentValidator';
import { ErrorMiddleware } from '../middlewares/errorMiddleware';
import UserResolver from '../utils/userResolver';

// Extensão de interface para suportar req.user e correlationId
declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; [key: string]: any };
    correlationId?: string;
  }
}

class CommentController {
  // Create a new comment
  createComment = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    console.log('[DEBUG Backend createComment] Body completo:', req.body);
    try {
      const body = req.body || {};
      
      // Get userId from body or req.user
      let userId: string = body.userId;
      
      // Check if req.user exists and has id
      if (req.user && req.user.id) {
        userId = req.user.id;
      }
      
      // If still no userId, use default user
      if (!userId || userId.trim() === '') {
        try {
          const defaultUserId = await UserResolver.getDefaultUserId();
          
          if (defaultUserId) {
            userId = defaultUserId;
            console.log(`Usando usuário padrão para criação de comentário: ${defaultUserId}`);
          } else {
            const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
            error.statusCode = 400;
            throw error;
          }
        } catch (error: any) {
          console.error('Erro ao buscar usuário padrão:', error.message);
          const fallbackError = new Error('Não foi possível determinar o usuário para criar o comentário.');
          fallbackError.statusCode = 400;
          throw fallbackError;
        }
      }
      
      // Prepare data for validation
      const dataForValidation = {
        content: body.content,
        taskId: body.taskId || body.task_id, // Suporte a snake_case vindo do front
        userId: userId,
        parentCommentId: body.parentCommentId
      };
      
      const validation = validateComment(dataForValidation);
      
      if (!validation.valid) {
        const error = new Error('Validation failed');
        error.name = 'ZodError';
        error.errors = (validation as any).error.errors;
        error.statusCode = 400;
        throw error;
      }

      const comment = await commentService.createComment(validation.data);
      
      res.status(201).json({
        success: true,
        message: 'Comment created successfully',
        comment,
        correlationId: req.correlationId
      });
    } catch (error: any) {
      if (error.message && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: error.message,
          message: 'Resource not found',
          correlationId: req.correlationId
        });
        return;
      }
      next(error);
    }
  });

  // Get all comments for a task
  getCommentsByTask = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { taskId } = req.params;
    const comments = await commentService.getCommentsByTask(taskId);
    
    res.json({
      success: true,
      count: comments.length,
      comments,
      correlationId: req.correlationId
    });
  });

  // Get comment by ID
  getCommentById = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const comment = await commentService.getCommentById(id);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      comment,
      correlationId: req.correlationId
    });
  });

  // Update comment
  updateComment = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const validation = validateCommentUpdate(req.body, id);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = (validation as any).error.errors;
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
      success: true,
      message: 'Comment updated successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Delete comment
  deleteComment = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const comment = await commentService.deleteComment(id);

    if (!comment) {
      const error = new Error('Comment not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      success: true,
      message: 'Comment deleted successfully',
      comment,
      correlationId: req.correlationId
    });
  });

  // Get comments by user ID
  getCommentsByUserId = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Implementação pendente no service
    const error = new Error('Method not implemented yet');
    error.statusCode = 501;
    throw error;
  });

  // Search comments
  searchComments = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { q } = req.query;
    
    if (!q || String(q).trim() === '') {
      const error = new Error('Search query is required');
      error.statusCode = 400;
      throw error;
    }

    const error = new Error('Method not implemented yet');
    error.statusCode = 501;
    throw error;
  });

  // Get replies for a comment
  getCommentReplies = ErrorMiddleware.catchAsync(async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const { commentId } = req.params;
    const replies = await commentService.getCommentReplies(commentId);
    
    res.json({
      success: true,
      count: replies.length,
      replies,
      correlationId: req.correlationId
    });
  });
}

export default new CommentController();