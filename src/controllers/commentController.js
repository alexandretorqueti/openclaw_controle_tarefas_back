// CommentController.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const commentService = require('../services/commentService');
const { validateComment, validateCommentUpdate } = require('../validators/commentValidator');
const { snakeToCamel } = require('../utils/caseConverter');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');
const UserResolver = require('../utils/userResolver');
class CommentController {
    constructor() {
        // Create a new comment
        this.createComment = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
                        const defaultUserId = yield UserResolver.getDefaultUserId();
                        if (defaultUserId) {
                            userId = defaultUserId;
                            console.log(`Usando usuário padrão para criação de comentário: ${defaultUserId}`);
                        }
                        else {
                            // Se não houver usuários, retornar erro
                            const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
                            error.statusCode = 400;
                            throw error;
                        }
                    }
                    catch (error) {
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
                    error.errors = validation.error.errors;
                    error.statusCode = 400;
                    throw error;
                }
                const comment = yield commentService.createComment(validation.data);
                res.status(201).json({
                    message: 'Comment created successfully',
                    comment,
                    correlationId: req.correlationId
                });
            }
            catch (error) {
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
        }));
        // Get all comments for a task
        this.getCommentsByTask = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { taskId } = req.params;
            const comments = yield commentService.getCommentsByTask(taskId);
            res.json({
                count: comments.length,
                comments,
                correlationId: req.correlationId
            });
        }));
        // Get comment by ID
        this.getCommentById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const comment = yield commentService.getCommentById(id);
            if (!comment) {
                const error = new Error('Comment not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                comment,
                correlationId: req.correlationId
            });
        }));
        // Update comment
        this.updateComment = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const validation = validateCommentUpdate(req.body);
            if (!validation.success) {
                const error = new Error('Validation failed');
                error.name = 'ZodError';
                error.errors = validation.error.errors;
                error.statusCode = 400;
                throw error;
            }
            const comment = yield commentService.updateComment(id, validation.data);
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
        }));
        // Delete comment
        this.deleteComment = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const comment = yield commentService.deleteComment(id);
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
        }));
        // Get comments by user ID
        this.getCommentsByUserId = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { userId } = req.params;
            // Note: This would need to be implemented in commentService
            const error = new Error('Method not implemented yet');
            error.statusCode = 501;
            throw error;
        }));
        // Search comments
        this.searchComments = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
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
        }));
        // Get replies for a comment
        this.getCommentReplies = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { commentId } = req.params;
            const replies = yield commentService.getCommentReplies(commentId);
            res.json({
                count: replies.length,
                replies,
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new CommentController();
