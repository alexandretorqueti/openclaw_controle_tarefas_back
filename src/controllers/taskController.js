const taskService = require('../services/taskService');
const { validateTask, validateTaskUpdate, validateTaskFilters } = require('../validators/taskValidator');

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
  async createTask(req, res, next) {
    try {
      // Convert snake_case to camelCase if needed
      const body = snakeToCamel(req.body);
      
      const validation = validateTask(body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      const task = await taskService.createTask(validation.data);
      
      res.status(201).json({
        message: 'Task created successfully',
        task
      });
    } catch (error) {
      next(error);
    }
  }

  // Get all tasks with filters
  async getAllTasks(req, res, next) {
    try {
      const validation = validateTaskFilters(req.query);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      const tasks = await taskService.getAllTasks(validation.data);
      
      res.json({
        count: tasks.length,
        tasks
      });
    } catch (error) {
      next(error);
    }
  }

  // Get task by ID
  async getTaskById(req, res, next) {
    try {
      const { id } = req.params;
      const task = await taskService.getTaskById(id);
      
      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }
      
      res.json(task);
    } catch (error) {
      next(error);
    }
  }

  // Update task
  async updateTask(req, res, next) {
    try {
      const { id } = req.params;
      // Convert snake_case to camelCase if needed
      const body = snakeToCamel(req.body);
      
      const validation = validateTaskUpdate(body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: 'Validation error',
          details: validation.error.errors
        });
      }

      // Check if task exists
      const existingTask = await taskService.getTaskById(id);
      if (!existingTask) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const updatedTask = await taskService.updateTask(id, validation.data);
      
      res.json({
        message: 'Task updated successfully',
        task: updatedTask
      });
    } catch (error) {
      next(error);
    }
  }

  // Delete task
  async deleteTask(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if task exists
      const existingTask = await taskService.getTaskById(id);
      if (!existingTask) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      await taskService.deleteTask(id);
      
      res.json({
        message: 'Task deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  }

  // Update task position
  async updateTaskPosition(req, res, next) {
    try {
      const { id } = req.params;
      const { position } = req.body;
      
      if (position === undefined || typeof position !== 'number' || position < 0) {
        return res.status(400).json({
          error: 'Invalid position value'
        });
      }

      // Check if task exists
      const existingTask = await taskService.getTaskById(id);
      if (!existingTask) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const updatedTask = await taskService.updateTaskPosition(id, position);
      
      res.json({
        message: 'Task position updated successfully',
        task: updatedTask
      });
    } catch (error) {
      next(error);
    }
  }

  // Toggle task completion
  async toggleTaskCompletion(req, res, next) {
    try {
      const { id } = req.params;
      
      // Check if task exists
      const existingTask = await taskService.getTaskById(id);
      if (!existingTask) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const updatedTask = await taskService.toggleTaskCompletion(id);
      
      res.json({
        message: `Task marked as ${updatedTask.isCompleted ? 'completed' : 'incomplete'}`,
        task: updatedTask
      });
    } catch (error) {
      next(error);
    }
  }

  // Get tasks by project
  async getTasksByProject(req, res, next) {
    try {
      const { projectId } = req.params;
      const filters = req.query;
      
      const tasks = await taskService.getTasksByProject(projectId, filters);
      
      res.json({
        count: tasks.length,
        tasks
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TaskController();