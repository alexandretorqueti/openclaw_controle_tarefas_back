import { Request, Response, NextFunction } from 'express';
import taskService, { TaskFilters } from '../services/taskService';
import { validateTask, validateTaskUpdate, validateTaskFilters } from '../validators/taskValidator';
import ErrorMiddleware from '../middlewares/errorMiddleware';
import { snakeToCamel } from '../utils/caseConverter';
import prismaExport from '../services/prismaService';
import UserResolver from '../utils/userResolver';
import { PrismaClient, Task } from '@prisma/client';

const prisma = ((prismaExport as { default?: PrismaClient }).default || prismaExport) as PrismaClient;

interface CustomRequest extends Request {
  correlationId?: string;
  body: Record<string, unknown>;
  query: Record<string, string | undefined>;
  params: Record<string, string>;
}

interface TaskResult extends Request {
  task: Task;
  correlationId?: string;
}

class TaskController {
  async _resolveUser(req: CustomRequest): Promise<{ id: string, name?: string } | null> {
    return await UserResolver.resolveUserFromRequest(req);
  }

  createTask = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const body = snakeToCamel(req.body) as Record<string, unknown>;
    const user = await this._resolveUser(req);
    
    let createdById = body.createdById as string | undefined;
    let assignedToId = body.assignedToId as string | undefined;

    if (user) {
      createdById = createdById || user.id;
      assignedToId = assignedToId || user.id;
    }

    if (!createdById) {
      try {
        const defaultUserId = await UserResolver.getDefaultUserId() as string | null;
        if (defaultUserId) {
          createdById = defaultUserId;
          assignedToId = assignedToId || defaultUserId;
          console.log(`Usando usuário padrão para criação de tarefa: ${defaultUserId}`);
        } else {
          const error = new Error('Nenhum usuário encontrado no sistema. É necessário criar um usuário primeiro.') as Error & { statusCode: number };
          error.statusCode = 400;
          throw error;
        }
      } catch (error: unknown) {
        const err = error as Error;
        console.error('Erro ao buscar usuário padrão:', err.message);
        const fallbackError = new Error('Não foi possível determinar o usuário para criar a tarefa. Certifique-se de que existem usuários no sistema.') as Error & { statusCode: number };
        fallbackError.statusCode = 400;
        throw fallbackError;
      }
    }
    
    const validatedBody = { ...body, createdById, assignedToId };
    const validation = validateTask(validatedBody);
    
    if (!validation.success) {
      const error = new Error('Validation failed') as Error & { name: string, errors: unknown, statusCode: number };
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

  getAllTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const validation = validateTaskFilters(req.query);
    if (!validation.success) {
      const error = new Error('Validation failed') as Error & { name: string, errors: unknown, statusCode: number };
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const data = validation.data as Record<string, unknown>;
    const filters: TaskFilters = {
      projectId: data.projectId as string | undefined,
      statusId: data.statusId as string | undefined,
      priorityId: data.priorityId as string | undefined,
      assignedToId: data.assignedToId as string | undefined,
      parentTaskId: data.parentTaskId as string | undefined,
      isCompleted: data.isCompleted === 'true' || data.isCompleted === true ? true : (data.isCompleted === 'false' || data.isCompleted === false ? false : undefined),
      search: data.search as string | undefined,
      sortBy: data.sortBy as string | undefined,
      sortOrder: data.sortOrder as 'asc' | 'desc' | undefined
    };

    const tasks = await taskService.getAllTasks(filters);
    res.json({
      count: tasks.length,
      tasks,
      correlationId: req.correlationId
    });
  });

  getTaskById = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const task = await taskService.getTaskById(id);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      task,
      correlationId: req.correlationId
    } as TaskResult);
  });

  updateTask = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const body = snakeToCamel(req.body) as Record<string, unknown>;
    
    const validation = validateTaskUpdate(body);
    if (!validation.success) {
      const error = new Error('Validation failed') as Error & { name: string, errors: unknown, statusCode: number };
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const task = await taskService.updateTask(id, validation.data);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task updated successfully',
      task,
      correlationId: req.correlationId
    });
  });

  deleteTask = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const task = await taskService.deleteTask(id);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task deleted successfully',
      task,
      correlationId: req.correlationId
    });
  });

  getTasksByProject = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { projectId } = req.params;
    const validation = validateTaskFilters(req.query);
    
    if (!validation.success) {
      const error = new Error('Validation failed') as Error & { name: string, errors: unknown, statusCode: number };
      error.name = 'ZodError';
      error.errors = validation.error.errors;
      error.statusCode = 400;
      throw error;
    }

    const data = validation.data as Record<string, unknown>;
    const filters: TaskFilters = {
      projectId: data.projectId as string | undefined,
      statusId: data.statusId as string | undefined,
      priorityId: data.priorityId as string | undefined,
      assignedToId: data.assignedToId as string | undefined,
      parentTaskId: data.parentTaskId as string | undefined,
      isCompleted: data.isCompleted === 'true' || data.isCompleted === true ? true : (data.isCompleted === 'false' || data.isCompleted === false ? false : undefined),
      search: data.search as string | undefined,
      sortBy: data.sortBy as string | undefined,
      sortOrder: data.sortOrder as 'asc' | 'desc' | undefined
    };

    const tasks = await taskService.getTasksByProject(projectId, filters);
    res.json({
      count: tasks.length,
      tasks,
      correlationId: req.correlationId
    });
  });

  getTasksByStatus = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getTasksByPriority = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getTasksByUserId = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getTasksWithRecurrence = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getOverdueTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getUpcomingTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  searchTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { q } = req.query;
    if (!q || typeof q !== 'string' || q.trim() === '') {
      const error = new Error('Search query is required') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  bulkUpdateTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { taskIds, updates } = req.body;
    
    if (!taskIds || !Array.isArray(taskIds) || taskIds.length === 0) {
      const error = new Error('Task IDs array is required') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    if (!updates || typeof updates !== 'object') {
      const error = new Error('Updates object is required') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  getTaskStatistics = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const error = new Error('Method not implemented yet') as Error & { statusCode: number };
    error.statusCode = 501;
    throw error;
  });

  exportTasks = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const tasks = await taskService.getAllTasks({});
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.csv');
    
    const csvRows: string[] = [];
    
    if (tasks.length > 0) {
      const headers = Object.keys(tasks[0] as object);
      csvRows.push(headers.join(','));
      
      tasks.forEach((task: Record<string, unknown>) => {
        const row = headers.map((header: string) => {
          const value = task[header];
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value !== null && value !== undefined ? String(value) : '';
        });
        csvRows.push(row.join(','));
      });
    }
    
    res.send(csvRows.join('\n'));
  });

  getNextTaskForUser = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
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

  updateTaskPosition = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const position = req.body.position as number;

    if (typeof position !== 'number') {
      const error = new Error('Position must be a number') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const task = await taskService.updateTaskPosition(id, position);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task position updated successfully',
      task,
      correlationId: req.correlationId
    });
  });

  toggleTaskCompletion = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    const task = await taskService.toggleTaskCompletion(id);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task completion toggled successfully',
      task,
      correlationId: req.correlationId
    });
  });

  finalizeTask = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    let userId = req.body.userId as string | undefined;
    const nickname = req.body.nickname as string | undefined;
    const executionNotes = req.body.executionNotes as string | undefined;

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
      const error = new Error('User ID ou nickname é obrigatório') as Error & { statusCode: number };
      error.statusCode = 400;
      throw error;
    }

    const task = await taskService.finalizeTask(id, userId, executionNotes || null);

    if (!task) {
      const error = new Error('Task not found') as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }

    res.json({
      message: 'Task finalized successfully',
      task,
      correlationId: req.correlationId
    });
  });

  finishTaskExecution = ErrorMiddleware.catchAsync(async (req: CustomRequest, res: Response, next: NextFunction): Promise<void> => {
    const { id } = req.params;
    
    console.warn(`⚠️ DEPRECATED: Endpoint /api/tasks/${id}/finish-execution chamado. ` +
                `Use lockService.releaseLock() em vez disso.`);
    
    const task = await prisma.task.findUnique({
      where: { id }
    });
    
    if (!task) {
      const error = new Error(`Task with ID ${id} not found`) as Error & { statusCode: number };
      error.statusCode = 404;
      throw error;
    }
    
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
