// src/controllers/taskHistoryController.js
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const taskHistoryService = require('../services/taskHistoryService');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = require('../services/prismaService');
const UserResolver = require('../utils/userResolver');
class TaskHistoryController {
    constructor() {
        // Get all history records for a task
        this.getHistoryByTask = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { taskId } = req.params;
            const history = yield taskHistoryService.getHistoryByTask(taskId);
            res.json({
                count: history.length,
                history,
                correlationId: req.correlationId
            });
        }));
        // Get history by ID
        this.getHistoryById = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const history = yield taskHistoryService.getHistoryById(id);
            if (!history) {
                const error = new Error('History record not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                history,
                correlationId: req.correlationId
            });
        }));
        // Create a new history record
        this.createHistory = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const body = req.body || {};
            // Garantir que temos um userId
            let userId = body.userId;
            if (!userId || userId.trim() === '') {
                try {
                    // Usar o helper UserResolver para obter ID do usuário padrão
                    const defaultUserId = yield UserResolver.getDefaultUserId();
                    if (defaultUserId) {
                        userId = defaultUserId;
                        console.log(`Usando usuário padrão para criação de histórico: ${defaultUserId}`);
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
                    const fallbackError = new Error('Não foi possível determinar o usuário para criar o histórico. Certifique-se de que existem usuários no sistema.');
                    fallbackError.statusCode = 400;
                    throw fallbackError;
                }
            }
            // Atualizar body com userId
            const dataWithUser = Object.assign(Object.assign({}, body), { userId });
            const history = yield taskHistoryService.createHistory(dataWithUser);
            res.status(201).json({
                message: 'History record created successfully',
                history,
                correlationId: req.correlationId
            });
        }));
        // Delete history record
        this.deleteHistory = ErrorMiddleware.catchAsync((req, res, next) => __awaiter(this, void 0, void 0, function* () {
            const { id } = req.params;
            const history = yield taskHistoryService.deleteHistory(id);
            if (!history) {
                const error = new Error('History record not found');
                error.statusCode = 404;
                throw error;
            }
            res.json({
                message: 'History record deleted successfully',
                history,
                correlationId: req.correlationId
            });
        }));
    }
}
module.exports = new TaskHistoryController();
