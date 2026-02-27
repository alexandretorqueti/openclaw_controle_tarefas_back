// src/controllers/taskController.js

const taskService = require('../services/taskService');
const { validateTask, validateTaskUpdate, validateTaskFilters } = require('../validators/taskValidator');
const ErrorMiddleware = require('../middlewares/errorMiddleware');

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

class TaskController {
  // Create a new task
  createTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    const validation = validateTask(body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
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
  getAllTasks = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const validation = validateTaskFilters(req.query);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
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
  getTaskById = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);
    
    if (!task) {
      const error = new Error(`Task with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }
    
    res.json({
      ...task,
      correlationId: req.correlationId
    });
  });

  // Update task
  updateTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    // Convert snake_case to camelCase if needed
    const body = snakeToCamel(req.body);
    
    const validation = validateTaskUpdate(body);
    
    if (!validation.success) {
      const error = new Error('Validation failed');
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    // Check if task exists
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      const error = new Error(`Task with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedTask = await taskService.updateTask(id, validation.data);
    
    res.json({
      message: 'Task updated successfully',
      task: updatedTask,
      correlationId: req.correlationId
    });
  });

  // Delete task
  deleteTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if task exists
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      const error = new Error(`Task with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    await taskService.deleteTask(id);
    
    res.json({
      message: 'Task deleted successfully',
      correlationId: req.correlationId
    });
  });

  // Update task position
  updateTaskPosition = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    const { position } = req.body;
    
    if (position === undefined || typeof position !== 'number' || position < 0) {
      const error = new Error('Invalid position value. Position must be a non-negative number.');
      error.statusCode = 400;
      throw error;
    }

    // Check if task exists
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      const error = new Error(`Task with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedTask = await taskService.updateTaskPosition(id, position);
    
    res.json({
      message: 'Task position updated successfully',
      task: updatedTask,
      correlationId: req.correlationId
    });
  });

  // Toggle task completion
  toggleTaskCompletion = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    // Check if task exists
    const existingTask = await taskService.getTaskById(id);
    if (!existingTask) {
      const error = new Error(`Task with ID ${id} not found`);
      error.statusCode = 404;
      throw error;
    }

    const updatedTask = await taskService.toggleTaskCompletion(id);
    
    res.json({
      message: `Task marked as ${updatedTask.isCompleted ? 'completed' : 'incomplete'}`,
      task: updatedTask,
      correlationId: req.correlationId
    });
  });

  // Get tasks by project
  getTasksByProject = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { projectId } = req.params;
    const filters = req.query;
    
    const tasks = await taskService.getTasksByProject(projectId, filters);
    
    res.json({
      count: tasks.length,
      tasks,
      correlationId: req.correlationId
    });
  });

    // Get next priority task for a user by nickname
  getNextTaskForUser = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { nickname } = req.params;
    
    // O service será responsável por buscar o ID do usuário pelo nickname,
    // filtrar as tarefas não concluídas, checar os status visíveis para IA
    // e ordenar pela prioridade/posição, retornando apenas a primeira.
    const task = await taskService.getNextTaskForUser(nickname);
    
    // Se não encontrou nenhuma tarefa elegível
    if (!task) {
      return res.status(200).json({
        success: false,
        message: 'Nenhuma tarefa elegível para IA no momento.',
        task: null,
        correlationId: req.correlationId
      });
    }

    // Se encontrou a tarefa
    res.status(200).json({
      success: true,
      message: 'Próxima tarefa encontrada com sucesso',
      task: task,
      correlationId: req.correlationId
    });
  });

  // Finalize task (mark as final status)
  finalizeTask = ErrorMiddleware.catchAsync(async (req, res, next) => {
    const { id } = req.params;
    
    const result = await taskService.finalizeTask(id);
    
    res.json({
      message: 'Task finalized successfully',
      task: result.task,
      finalStatus: result.finalStatus,
      correlationId: req.correlationId
    });
  });

}




module.exports = new TaskController();

