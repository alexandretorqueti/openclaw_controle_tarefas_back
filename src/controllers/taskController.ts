// Migrado para TypeScript - Fase: Controllers
// Arquivo: taskController.js

// src/controllers/taskController.js

import taskService from '../services/taskService';
import { validateTask, validateTaskUpdate, validateTaskSearch } from '../validators/taskValidator';
import { ErrorMiddleware } from '../middlewares/errorMiddleware';
import { snakeToCamel } from '../utils/caseConverter';
import prisma from '../services/prismaService';
import UserResolver from '../utils/userResolver';

class TaskController {
  /**
   * Helper para obter usuário a partir do nickname ou userId
   * Aceita: body.nickname, body.userNickname, body.createdByNickname, 
   *         body.createdById, header X-User-Nickname, body.createBy
   */
  async _resolveUser(req): Promise<any> {
    return await UserResolver.resolveUserFromRequest(req);
  }

  // Create a new task
  createTask = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    // Resolver usuário
    const user = await this._resolveUser(req);
    
    // Usar o usuário resolvido ou aceitar createdById/assignedToId do body
    let createdById = body.createdById;
    let assignedToId = body.assignedToId;

    if (user) {
      createdById = createdById || user.id;
      assignedToId = assignedToId || user.id;
    }

    // Se não temos createdById, tentar obter usuário padrão
    if (!createdById) {
      try {
        // Usar o helper UserResolver para obter ID do usuário padrão
        const defaultUserId = await UserResolver.getDefaultUserId();
        
        if (defaultUserId) {
          createdById = defaultUserId;
          assignedToId = assignedToId || defaultUserId;
          console.log(`Usando usuário padrão para criação de tarefa: ${defaultUserId}`);
        } else {
          // Se não houver usuários, retornar erro
          const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.');
          (error as any).statusCode = 400;
          throw error;
        }
      } catch (error) {
        console.error('Erro ao buscar usuário padrão:', error.message);
        // Não usar mais ID fixo - retornar erro
        const fallbackError = new Error('Não foi possível determinar o usuário para criar a tarefa. Certifique-se de que existem usuários no sistema.');
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    // Update body with user's IDs
    const validatedBody = { ...body, createdById, assignedToId };
    
    const validation = validateTask(validatedBody);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      (error as any).errors = validation.errors;
      (error as any).statusCode = 400;
      throw error;
    }

    const task = await taskService.createTask(validation.data);
    
    res.status(201).json({
      message: 'Task created successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Get all tasks with filters
  getAllTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const validation = validateTaskSearch(req.query);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      (error as any).errors = validation.errors;
      (error as any).statusCode = 400;
      throw error;
    }

    const tasks = await taskService.getAllTasks(validation.data);
    
    res.json({
      count: tasks.length,
      tasks,
      correlationId: req.correlationId
    });
  });

  // Get task by ID
  getTaskById = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      task,
      correlationId: req.correlationId
    });
  });

  // Update task
  updateTask = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    // Log for debugging date issues
    if (body.deadline !== undefined) {

    }
    
    const validation = validateTaskUpdate(body, id);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      (error as any).errors = validation.errors;
      (error as any).statusCode = 400;
      throw error;
    }

    const task = await taskService.updateTask(id, validation.data);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task updated successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Delete task
  deleteTask = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const task = await taskService.deleteTask(id);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task deleted successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Get tasks by project (using getAllTasks with project filter)
  getTasksByProject = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { projectId } = req.params;
    
    // Validate filters from query string
    const validation = validateTaskSearch(req.query);
    
    if (!validation.valid) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      (error as any).errors = validation.errors;
      (error as any).statusCode = 400;
      throw error;
    }

    // Pass both projectId and filters to service
    const tasks = await taskService.getTasksByProject(projectId, validation.data);
    
    res.json({
      count: tasks.length,
      tasks,
      correlationId: req.correlationId
    });
  });

  // Get tasks by status (using getAllTasks with status filter)
  getTasksByStatus = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { status } = req.params;
    // Note: This would need to be implemented in taskService
    // For now, we'll use getAllTasks with a custom filter
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get tasks by priority (using getAllTasks with priority filter)
  getTasksByPriority = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { priority } = req.params;
    // Note: This would need to be implemented in taskService
    // For now, we'll use getAllTasks with a custom filter
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get tasks by user ID (using getAllTasks with user filter)
  getTasksByUserId = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { userId } = req.params;
    // Note: This would need to be implemented in taskService
    // For now, we'll use getAllTasks with a custom filter
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get tasks with recurrence
  getTasksWithRecurrence = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get overdue tasks
  getOverdueTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get upcoming tasks
  getUpcomingTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Search tasks
  searchTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { q } = req.query;
    
    if (!q || typeof q !== 'string' || q.trim() === '') {
      const error = new Error('Search query is required');
      (error as any).statusCode = 400;
      throw error;
    }

    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Bulk update tasks
  bulkUpdateTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { taskIds, updates } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      const error = new Error('Task IDs array is required');
      (error as any).statusCode = 400;
      throw error;
    }

    if (!updates || typeof updates !== 'object') {
      const error = new Error('Updates object is required');
      (error as any).statusCode = 400;
      throw error;
    }

    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Get task statistics
  getTaskStatistics = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    // Note: This would need to be implemented in taskService
    const error = new Error('Method not implemented yet');
    (error as any).statusCode = 501;
    throw error;
  });

  // Export tasks
  exportTasks = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const tasks = await taskService.getAllTasks({});
    
    // Set headers for CSV export
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; __filename=tasks_export.csv');
    
    // Simple CSV generation
    const csvRows = [];
    
    // Add header
    if (tasks.length > 0) {
      const headers = Object.keys(tasks[0]);
      csvRows.push(headers.join(','));
      
      // Add data rows
      tasks.forEach(task => {
        const row = headers.map(header => {
          const value = task[header];
          // Escape commas and quotes in CSV
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value || '';
        });
        csvRows.push(row.join(','));
      });
    }
    
    res.send(csvRows.join('\n'));
  });

  // Get next task for user by nickname
  getNextTaskForUser = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { nickname } = req.params;
    const task = await taskService.getNextTaskForUser(nickname);

    if (!task) {
      res.json({
        success: true,
        message: 'Nenhuma tarefa pendente encontrada para o usuário',
        task: null,
        correlationId: req.correlationId
      });
    } else {
      res.json({
        success: true,
        message: 'Próxima tarefa encontrada com sucesso',
        task: task,
        correlationId: req.correlationId
      });
    }
  });

  // Update task position
  updateTaskPosition = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const { position } = req.body;

    if (typeof position !== 'number') {
      const error = new Error('Position must be a number');
      (error as any).statusCode = 400;
      throw error;
    }

    const task = await taskService.updateTaskPosition(id, position);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task position updated successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Toggle task completion
  toggleTaskCompletion = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    const task = await taskService.toggleTaskCompletion(id);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task completion toggled successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Finalize task
  finalizeTask = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    const { id } = req.params;
    let { userId, nickname, executionNotes } = req.body;

    // Se não tem userId, tentar resolver por nickname
    if (!userId && nickname) {
      const user = await prisma.user.findUnique({
        where: { nickname: nickname.trim() },
        select: { id: true }
      });
      if (user) {
        userId = user.id;
      }
    }

    if (!userId) {
      const error = new Error('User ID ou nickname é obrigatório');
      (error as any).statusCode = 400;
      throw error;
    }

    const task = await taskService.finalizeTask(id, userId, executionNotes);

    if (!task) {
      const error = new Error('Task not found');
      (error as any).statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task finalized successfully',
      task,
      correlationId: req.correlationId
    });
  });

  // Finish task execution - Set isExecuting to false
  finishTaskExecution = ErrorMiddleware.catchAsync(async (req, res, next): Promise<any> => {
    let { id } = req.params;
    
    // Ensure id is a string, not an array
    if (Array.isArray(id)) {
      id = id[0];
    }
    
    console.warn(`⚠️ DEPRECATED: Endpoint /api/tasks/${id}/finish-execution chamado. ` +
                `Use lockService.releaseLock() em vez disso.`);
    
    // Verificar se a tarefa existe
    const task = await prisma.task.findUnique({
      where: { id }
    });
    
    if (!task) {
      const error = new Error(`Task with ID ${id} not found`);
      (error as any).statusCode = 404;
      throw error;
    }
    
    // Atualizar isExecuting para false
    const updatedTask = await prisma.task.update({
      where: { id },
      data: { isExecuting: false },
      include: {
        priority: true,
        status: true,
        project: {
          select: {
            id: true,
            name: true,
            ativo: true,
            status: true,
            modeloAuxiliar: true,
            programadorBack: true,
            programadorFront: true,
            projectType: true,
            agent: true
          }
        }
      }
    });
    
    console.log(`✅ Tarefa "${updatedTask.title}" finalizada (isExecuting: false)`);
    
    res.status(200).json({
      success: true,
      message: 'Task execution finished successfully',
      task: updatedTask
    });
  });
}

export default new TaskController();
