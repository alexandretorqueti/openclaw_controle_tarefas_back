// src/controllers/taskHistoryController.js

const taskHistoryService = require('../services/taskHistoryService');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const _prisma = require('../services/prismaService');
const prisma = _prisma.default || _prisma;
const UserResolver = require('../utils/userResolver');

class TaskHistoryController {
  // Get all history records for a task
  getHistoryByTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { taskId } = req.params;
    const history = await taskHistoryService.getHistoryByTask(taskId);
    
    res.json({
      count: history.length,
      history,
      correlationId: req.correlationId
    });
  });

  // Get history by ID
  getHistoryById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const history = await taskHistoryService.getHistoryById(id);

    if (!history) {
      const error = new Error('History record not found');
      error.statusCode = 404;
      throw error;
    }

    res.json({
      history,
      correlationId: req.correlationId
    });
  });

  // Create a new history record
  createHistory = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const body = req.body || {};
    
    // Garantir que temos um userId
    let userId = body.userId;
    
    if (!userId || userId.trim() === '') {
      try {
        // Usar o helper UserResolver para obter ID do usuário padrão
        const defaultUserId = await UserResolver.getDefaultUserId();
        
        if (defaultUserId) {
          userId = defaultUserId;
          console.log(`Usando usuário padrão para criação de histórico: ${defaultUserId}`);
        } else {
          // Se não houver usuários, retornar erro
          const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
          error.statusCode = 400;
          throw error;
        }
      } catch (error) {
        console.error('Erro ao buscar usuário padrão:', error.message);
        // Não usar mais ID fixo - retornar erro
        const fallbackError = new Error('Não foi possível determinar o usuário para criar o histórico. Certifique-se de que existem usuários no sistema.');
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    // Atualizar body com userId
    const dataWithUser = { ...body, userId };
    
    const history = await taskHistoryService.createHistory(dataWithUser);
    
    res.status(201).json({
      message: 'History record created successfully',
      history,
      correlationId: req.correlationId
    });
  });

  // Delete history record
  deleteHistory = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const history = await taskHistoryService.deleteHistory(id);

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
  });
}

module.exports = new TaskHistoryController();
