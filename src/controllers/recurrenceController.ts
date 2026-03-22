// Migrado para TypeScript - Fase: Controllers
// Arquivo: recurrenceController.js

import taskService from '../services/taskService';

class RecurrenceController {
  // Get recurring tasks that are due for execution
  async getRecurringTasksDue(req, res, next): Promise<any> {
    try {
      const tasks = await taskService.getRecurringTasksDue();
      
      res.json({
        count: tasks.length,
        tasks: tasks.map(task => ({
          ...task,
          recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
          recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null
        }))
      });
    } catch (error) {
      next(error);
    }
  }

  // Mark task as executed
  async markTaskAsExecuted(req, res, next): Promise<any> {
    try {
      const { id } = req.params;
      
      // Check if task exists
      const existingTask = await taskService.getTaskById(id);
      if (!existingTask) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      const updatedTask = await taskService.markTaskAsExecuted(id);
      
      res.json({
        message: 'Task marked as executed successfully',
        task: {
          ...updatedTask,
          recurrenceTimes: updatedTask.recurrenceTimes ? JSON.parse(updatedTask.recurrenceTimes) : null,
          recurrenceDays: updatedTask.recurrenceDays ? JSON.parse(updatedTask.recurrenceDays) : null
        }
      });
    } catch (error) {
      next(error);
    }
  }

  // Execute all due recurring tasks
  async executeAllDueTasks(req, res, next): Promise<any> {
    try {
      const dueTasks = await taskService.getRecurringTasksDue();
      const results = [];
      
      for (const task of dueTasks) {
        try {
          const updatedTask = await taskService.markTaskAsExecuted(task.id);
          results.push({
            taskId: task.id,
            title: task.title,
            status: 'executed',
            nextExecutionAt: updatedTask.nextExecutionAt
          });
        } catch (error) {
          results.push({
            taskId: task.id,
            title: task.title,
            status: 'error',
            error: error.message
          });
        }
      }
      
      res.json({
        message: `Executed ${results.filter(r => r.status === 'executed').length} out of ${dueTasks.length} due tasks`,
        results
      });
    } catch (error) {
      next(error);
    }
  }

  // Calculate next execution for a task
  async calculateNextExecution(req, res, next): Promise<any> {
    try {
      const { id } = req.params;
      
      const task = await taskService.getTaskById(id);
      if (!task) {
        return res.status(404).json({
          error: 'Task not found'
        });
      }

      if (!task.isRecurring) {
        return res.status(400).json({
          error: 'Task is not recurring'
        });
      }

      const taskData = {
        isRecurring: task.isRecurring,
        recurrenceType: task.recurrenceType,
        recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
        recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null,
        lastExecutedAt: task.lastExecutedAt
      };

      const nextExecution = taskService.calculateNextExecution(taskData);
      
      res.json({
        taskId: task.id,
        title: task.title,
        currentNextExecution: task.nextExecutionAt,
        calculatedNextExecution: nextExecution,
        taskData
      });
    } catch (error) {
      next(error);
    }
  }
}

export default new RecurrenceController();