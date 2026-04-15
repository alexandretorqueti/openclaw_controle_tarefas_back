import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

import prismaExport from './prismaService';
const prisma = ((prismaExport as any).default || prismaExport) as any;

import NotificationService from './notificationService';
import sseService from './sseService';
import taskHierarchyService from './taskHierarchyService';

class ValidationError extends Error {
  validationErrors?: string[];
  statusCode?: number;
}

export interface TaskData {
  id?: string;
  title?: string;
  description?: string;
  deadline?: Date | string | null;
  position?: number;
  isCompleted?: boolean;
  isRecurring?: boolean;
  recurrenceType?: string | null;
  recurrenceTimes?: string | string[] | null;
  recurrenceDays?: string | number[] | null;
  lastExecutedAt?: Date | null;
  nextExecutionAt?: Date | null;
  projectId?: string;
  statusId?: string;
  priorityId?: string;
  createdById?: string;
  assignedToId?: string;
  agent?: string | null;
  parentTaskId?: string | null;
  totalSubtasks?: number;
  isExecuting?: boolean;
  hasChildExecuting?: boolean;
  updatedAt?: Date;
  arquitetosPromptContent?: string;
  arquitetosAnalysisContent?: string;
  arquitetosTerminalContent?: string;
  programadorTerminalContent?: string;
  programadorReportContent?: string;
  isAtomic?: boolean;
  domain?: string;
  statusChangeNotes?: string;
  userId?: string;
  [key: string]: any;
}

export interface TaskFilters {
  projectId?: string;
  statusId?: string;
  priorityId?: string;
  assignedToId?: string;
  parentTaskId?: string | null;
  isCompleted?: boolean;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  [key: string]: any;
}

class TaskService {
  exec(command: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(command, args, { cwd, stdio: 'pipe' });
      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (data: Buffer) => stdout += data.toString());
      child.stderr.on('data', (data: Buffer) => stderr += data.toString());
      child.on('close', (code: number | null) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`${command} ${args[0]} failed: ${stderr}`));
      });
    });
  }

  async checkAndCommit(projectPath: string, taskId: string, taskTitle: string): Promise<boolean> {
    return false;
  }

  async buildProject(projectPath: string): Promise<{ success: boolean; output: string }> {
    try {
      const buildResult = await this.exec('npm', ['run', 'build'], projectPath);
      return { success: true, output: buildResult };
    } catch (error: unknown) {
      return { success: false, output: (error as Error).message };
    }
  }

  async validateReferences(data: TaskData): Promise<Record<string, unknown>> {
    const errors: string[] = [];
    
    const project = await prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) errors.push(`Project with ID ${data.projectId} not found`);
    
    const status = await prisma.status.findUnique({ where: { id: data.statusId } });
    if (!status) errors.push(`Status with ID ${data.statusId} not found`);
    
    const priority = await prisma.priority.findUnique({ where: { id: data.priorityId } });
    if (!priority) errors.push(`Priority with ID ${data.priorityId} not found`);
    
    const creator = await prisma.user.findUnique({ where: { id: data.createdById } });
    if (!creator) errors.push(`Creator with ID ${data.createdById} not found`);
    
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
    if (!assignee) errors.push(`Assignee with ID ${data.assignedToId} not found`);
    
    if (data.parentTaskId) {
      const parentTask = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
      if (!parentTask) {
        errors.push(`Parent task with ID ${data.parentTaskId} not found`);
      } else if (parentTask.projectId !== data.projectId) {
        errors.push(`Parent task belongs to a different project`);
      }
    }
    
    if (errors.length > 0) {
      const error = new ValidationError(`Validation failed: ${errors.join(', ')}`);
      error.validationErrors = errors;
      error.statusCode = 400;
      throw error;
    }
    
    return { project, status, priority, creator, assignee };
  }

  async createTask(data: TaskData): Promise<Record<string, unknown>> {
    await this.validateReferences(data);
    
    const recurrenceTimes = data.recurrenceTimes ? 
      (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) : 
      null;
    const recurrenceDays = data.recurrenceDays ? 
      (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) : 
      null;
    
    let nextExecutionAt = null;
    if (data.isRecurring && data.recurrenceType) {
      nextExecutionAt = this.calculateNextExecution(data);
    }
    
    const transaction: unknown[] = [];
    
    transaction.push(
      prisma.task.create({
        data: {
          title: data.title,
          description: data.description,
          deadline: data.deadline ? new Date(data.deadline) : null,
          position: data.position || 0,
          isCompleted: data.isCompleted || false,
          isRecurring: data.isRecurring || false,
          recurrenceType: data.recurrenceType || null,
          recurrenceTimes: recurrenceTimes,
          recurrenceDays: recurrenceDays,
          lastExecutedAt: null,
          nextExecutionAt: nextExecutionAt,
          projectId: data.projectId,
          statusId: data.statusId,
          priorityId: data.priorityId,
          createdById: data.createdById,
          assignedToId: data.assignedToId,
          agent: data.agent || null,
          parentTaskId: data.parentTaskId || null,
          totalSubtasks: 0
        },
        include: {
          subtasks: { select: { id: true, title: true, isCompleted: true } },
          project: { select: { id: true, name: true } },
          status: true,
          priority: true,
          createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
          assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
          parentTask: { select: { id: true, title: true } }
        }
      })
    );
    
    if (data.parentTaskId) {
      transaction.push(
        prisma.task.update({
          where: { id: data.parentTaskId },
          data: { totalSubtasks: { increment: 1 } }
        })
      );
    }
    
    const results = await prisma.$transaction(transaction);
    const newTask = results[0] as Record<string, unknown>;
    
    try {
      console.log(`📢 TaskService (PRE-BROADCAST): Preparando para emitir task_created para ${newTask.id}. Clientes conectados: ${sseService.clients.length}`);
      sseService.broadcast('task_created', newTask);
      console.log(`✅ TaskService: Evento task_created emitido com sucesso`);
    } catch (error) {
      console.error(`❌ TaskService: Erro ao emitir evento task_created:`, error);
    }
    
    return newTask;
  }

  async getAllTasks(filters: TaskFilters = {}): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = {};

    if (filters.projectId) where.projectId = filters.projectId;
    if (filters.statusId) where.statusId = filters.statusId;
    if (filters.priorityId) where.priorityId = filters.priorityId;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;

    if (filters.parentTaskId !== undefined) {
      if (filters.parentTaskId === null || filters.parentTaskId === '' || filters.parentTaskId === 'null') {
        where.parentTaskId = null;
      } else {
        where.parentTaskId = filters.parentTaskId;
      }
    } else {
      where.parentTaskId = null;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === true;
    } else {
      where.isCompleted = false;
    }
    
    console.log('DEBUG getAllTasks final where:', JSON.stringify(where));

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    return await prisma.task.findMany({
      where,
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: { select: { id: true, name: true, description: true, regras: true } },
        status: true,
        priority: true,
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parentTask: { select: { id: true, title: true } },
      },
      orderBy: {
        [filters.sortBy || 'deadline']: filters.sortOrder || 'asc'
      }
    });
  }

  async getTaskById(id: string): Promise<Record<string, unknown> | null> {
    return await prisma.task.findUnique({
      where: { id },
      include: {
        subtasks: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            status: true,
            priority: true,
            assignedTo: { select: { id: true, name: true, avatarUrl: true } }
          }
        },
        project: { select: { id: true, name: true, description: true, regras: true } },
        status: true,
        priority: true,
        createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
        assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
        parentTask: { select: { id: true, title: true } },
        dependencies: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            dependentTask: { select: { id: true, title: true, status: true } }
          }
        },
        dependents: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            task: { select: { id: true, title: true, status: true } }
          }
        },
        comments: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            user: { select: { id: true, name: true, avatarUrl: true } },
            replies: { include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, user: { select: { id: true, name: true, avatarUrl: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        },
        attachments: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            user: { select: { id: true, name: true } }
          },
          orderBy: { createdAt: 'desc' }
        },
        history: {
          include: {
            subtasks: { select: { id: true, title: true, isCompleted: true } },
            user: { select: { id: true, name: true } }
          },
          orderBy: { timestamp: 'desc' }
        }
      }
    });
  }

  async validateUpdateReferences(id: string, data: TaskData): Promise<void> {
    const errors: string[] = [];
    
    const currentTask = await prisma.task.findUnique({
      where: { id },
      include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, project: true }
    });
    
    if (!currentTask) {
      throw new Error(`Task with ID ${id} not found`);
    }
    
    if (data.projectId) {
      const project = await prisma.project.findUnique({ where: { id: data.projectId } });
      if (!project) errors.push(`Project with ID ${data.projectId} not found`);
    }
    
    if (data.statusId) {
      const status = await prisma.status.findUnique({ where: { id: data.statusId } });
      if (!status) errors.push(`Status with ID ${data.statusId} not found`);
    }
    
    if (data.priorityId) {
      const priority = await prisma.priority.findUnique({ where: { id: data.priorityId } });
      if (!priority) errors.push(`Priority with ID ${data.priorityId} not found`);
    }
    
    if (data.assignedToId) {
      const assignee = await prisma.user.findUnique({ where: { id: data.assignedToId } });
      if (!assignee) errors.push(`Assignee with ID ${data.assignedToId} not found`);
    }
    
    if (data.parentTaskId !== undefined) {
      if (data.parentTaskId !== null) {
        const parentTask = await prisma.task.findUnique({ where: { id: data.parentTaskId } });
        if (!parentTask) {
          errors.push(`Parent task with ID ${data.parentTaskId} not found`);
        } else {
          const targetProjectId = data.projectId || currentTask.projectId;
          if (parentTask.projectId !== targetProjectId) {
            errors.push(`Parent task belongs to a different project`);
          }
          if (parentTask.id === id) {
            errors.push(`Task cannot be its own parent`);
          }
        }
      }
    }
    
    if (errors.length > 0) {
      const error = new ValidationError(`Validation failed: ${errors.join(', ')}`);
      error.validationErrors = errors;
      error.statusCode = 400;
      throw error;
    }
  }

  async updateTask(id: string, data: TaskData): Promise<Record<string, unknown>> {
    await this.validateUpdateReferences(id, data);
    
    const oldTask = await prisma.task.findUnique({
      where: { id },
      select: { statusId: true, createdById: true, isExecuting: true, parentTaskId: true }
    });

    if (!oldTask) {
      throw new Error(`Task with ID ${id} not found`);
    }

    if (data.isExecuting !== undefined && data.isExecuting !== null) {
      console.log(`🔍 TaskService: Verificando mudança de isExecuting para task ${id}, novo valor: ${data.isExecuting}, antigo: ${oldTask.isExecuting}`);
      if (oldTask.isExecuting !== data.isExecuting) {
        console.log(`🔄 TaskService: isExecuting MUDOU de ${oldTask.isExecuting} para ${data.isExecuting} na tarefa ${id}`);
        try {
          await taskHierarchyService.updateHierarchyOnExecutionChange(id, data.isExecuting);
          console.log(`✅ TaskService: Hierarquia atualizada para task ${id}`);
        } catch (hierarchyError: unknown) {
          console.error(`❌ TaskService: Erro ao atualizar hierarquia: ${(hierarchyError as Error).message}`);
        }
      } else {
        console.log(`ℹ️ TaskService: isExecuting NÃO mudou para task ${id} (antigo: ${oldTask.isExecuting}, novo: ${data.isExecuting})`);
      }
    }

    const updateData: Record<string, unknown> = {
      title: data.title,
      description: data.description,
      deadline: data.deadline !== undefined ? (data.deadline ? new Date(data.deadline) : null) : undefined,
      position: data.position,
      isCompleted: data.isCompleted,
      projectId: data.projectId,
      statusId: data.statusId,
      priorityId: data.priorityId,
      assignedToId: data.assignedToId,
      parentTaskId: data.parentTaskId,
      agent: data.agent,
      isExecuting: data.isExecuting,
      hasChildExecuting: data.hasChildExecuting,
      updatedAt: new Date(),
      arquitetosPromptContent: data.arquitetosPromptContent,
      arquitetosAnalysisContent: data.arquitetosAnalysisContent,
      arquitetosTerminalContent: data.arquitetosTerminalContent,
      programadorTerminalContent: data.programadorTerminalContent,
      programadorReportContent: data.programadorReportContent,
      isAtomic: data.isAtomic,
      domain: data.domain
    };

    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;
    if (data.recurrenceType !== undefined) updateData.recurrenceType = data.recurrenceType;
    if (data.recurrenceTimes !== undefined) {
      updateData.recurrenceTimes = data.recurrenceTimes ? 
        (typeof data.recurrenceTimes === 'string' ? data.recurrenceTimes : JSON.stringify(data.recurrenceTimes)) : null;
    }
    if (data.recurrenceDays !== undefined) {
      updateData.recurrenceDays = data.recurrenceDays ? 
        (typeof data.recurrenceDays === 'string' ? data.recurrenceDays : JSON.stringify(data.recurrenceDays)) : null;
    }
    
    if (data.isRecurring || data.recurrenceType || data.recurrenceTimes || data.recurrenceDays) {
      const taskData = await prisma.task.findUnique({
        where: { id },
        select: { isRecurring: true, recurrenceType: true, recurrenceTimes: true, recurrenceDays: true, lastExecutedAt: true }
      });
      
      const combinedData = {
        isRecurring: data.isRecurring !== undefined ? data.isRecurring : taskData.isRecurring,
        recurrenceType: data.recurrenceType !== undefined ? data.recurrenceType : taskData.recurrenceType,
        recurrenceTimes: data.recurrenceTimes !== undefined ? data.recurrenceTimes : (taskData.recurrenceTimes ? JSON.parse(taskData.recurrenceTimes) : null),
        recurrenceDays: data.recurrenceDays !== undefined ? data.recurrenceDays : (taskData.recurrenceDays ? JSON.parse(taskData.recurrenceDays) : null),
        lastExecutedAt: taskData.lastExecutedAt
      };
      
      if (combinedData.isRecurring && combinedData.recurrenceType) {
        updateData.nextExecutionAt = this.calculateNextExecution(combinedData);
      } else {
        updateData.nextExecutionAt = null;
      }
    }

    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const transaction: unknown[] = [];
    const oldParentTaskId = oldTask.parentTaskId;
    const newParentTaskId = data.parentTaskId !== undefined ? data.parentTaskId : oldParentTaskId;
    
    if (oldParentTaskId !== newParentTaskId) {
      if (oldParentTaskId) {
        transaction.push(prisma.task.update({ where: { id: oldParentTaskId }, data: { totalSubtasks: { decrement: 1 } } }));
      }
      if (newParentTaskId) {
        transaction.push(prisma.task.update({ where: { id: newParentTaskId }, data: { totalSubtasks: { increment: 1 } } }));
      }
    }

    transaction.push(
      prisma.task.update({
        where: { id },
        data: updateData,
        include: {
          subtasks: { select: { id: true, title: true, isCompleted: true } },
          project: true,
          status: true,
          priority: true,
          createdBy: true,
          assignedTo: true
        }
      })
    );

    if (data.statusId && oldTask && data.statusId !== oldTask.statusId) {
      const userId = data.userId || oldTask.createdById;
      if (userId) {
        transaction.push(
          prisma.taskHistory.create({
            data: { taskId: id, userId: userId, oldStatusId: oldTask.statusId, newStatusId: data.statusId, notes: data.statusChangeNotes }
          })
        );
      } else {
        console.warn(`Cannot create task history for task ${id}: userId not available`);
      }
    }

    const results = await prisma.$transaction(transaction);
    
    try {
      await taskHierarchyService.updateHierarchyOnExecutionChange(id, false);
    } catch (err: unknown) {
      console.error('Erro ao atualizar hierarquia no updateTask:', (err as Error).message);
    }
    
    sseService.broadcast('task_updated', results[0]);
    return results[0] as Record<string, unknown>;
  }

  async startTaskExecution(taskId: string): Promise<Record<string, unknown>> {
    console.log(`🚀 Iniciando execução exclusiva da tarefa ${taskId}...`);
    const activeTasks = await prisma.task.findMany({
      where: { isExecuting: true, id: { not: taskId } },
      select: { id: true }
    });
    
    for (const activeTask of activeTasks) {
      await this.stopTaskExecution(activeTask.id);
    }
    return await this.updateTask(taskId, { isExecuting: true });
  }

  async stopTaskExecution(taskId: string): Promise<Record<string, unknown>> {
    console.log(`🛑 Parando a execução da tarefa ${taskId}...`);
    return await this.updateTask(taskId, { isExecuting: false });
  }

  async deleteTask(id: string): Promise<Record<string, unknown>> {
    const taskToDelete = await prisma.task.findUnique({ where: { id } });
    if (taskToDelete && taskToDelete.isExecuting) {
      try {
        await taskHierarchyService.updateHierarchyOnExecutionChange(id, false);
      } catch (err: unknown) {
        console.error('Erro ao atualizar hierarquia antes de deletar:', (err as Error).message);
      }
    }
    
    const transaction: unknown[] = [];
    transaction.push(prisma.dependency.deleteMany({ where: { OR: [{ taskId: id }, { dependentTaskId: id }] } }));
    transaction.push(prisma.comment.deleteMany({ where: { taskId: id } }));
    transaction.push(prisma.attachment.deleteMany({ where: { taskId: id } }));
    transaction.push(prisma.taskHistory.deleteMany({ where: { taskId: id } }));
    
    if (taskToDelete && taskToDelete.parentTaskId) {
      transaction.push(prisma.task.update({ where: { id: taskToDelete.parentTaskId }, data: { totalSubtasks: { decrement: 1 } } }));
    }
    
    transaction.push(prisma.task.delete({ where: { id } }));
    const results = await prisma.$transaction(transaction);
    const deletedTask = results[results.length - 1] as Record<string, unknown>;
    
    sseService.broadcast('task_deleted', { id: deletedTask.id });
    return deletedTask;
  }

  async updateTaskPosition(id: string, position: number): Promise<Record<string, unknown>> {
    const updatedTask = await prisma.task.update({
      where: { id },
      data: { position },
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: true, status: true, priority: true
      }
    });
    sseService.broadcast('task_updated', updatedTask);
    return updatedTask;
  }

  async toggleTaskCompletion(id: string): Promise<Record<string, unknown>> {
    const task = await prisma.task.findUnique({ where: { id }, select: { isCompleted: true } });
    if (!task) throw new Error('Task not found');

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { isCompleted: !task.isCompleted, updatedAt: new Date() },
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: true, status: true, priority: true
      }
    });
    sseService.broadcast('task_updated', updatedTask);
    return updatedTask;
  }

  async getTasksByProject(projectId: string, filters: TaskFilters = {}): Promise<Record<string, unknown>[]> {
    const where: Record<string, unknown> = { projectId };
    if (filters.statusId) where.statusId = filters.statusId;

    if (filters.parentTaskId !== undefined) {
      if (filters.parentTaskId === null || filters.parentTaskId === '' || filters.parentTaskId === 'null') {
        where.parentTaskId = null;
      } else {
        where.parentTaskId = filters.parentTaskId;
      }
    } else {
      where.parentTaskId = null;
    }

    if (filters.isCompleted !== undefined) {
      where.isCompleted = filters.isCompleted === true;
    } else {
      where.isCompleted = false;
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    console.log('DEBUG getTasksByProject final where:', JSON.stringify(where));
    return await prisma.task.findMany({
      where,
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: { select: { id: true, name: true, description: true, regras: true } },
        status: true, priority: true,
        assignedTo: { select: { id: true, name: true, avatarUrl: true } }
      },
      orderBy: { position: 'asc' }
    });
  }

  async getRecurringTasksDue(): Promise<Record<string, unknown>[]> {
    const now = new Date();
    return await prisma.task.findMany({
      where: {
        isRecurring: true, isCompleted: false,
        OR: [{ nextExecutionAt: { lte: now } }, { nextExecutionAt: null, lastExecutedAt: null }]
      },
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: true, status: true, priority: true,
        assignedTo: { select: { id: true, name: true, email: true } }
      }
    });
  }

  async markTaskAsExecuted(taskId: string): Promise<Record<string, unknown>> {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { isRecurring: true, recurrenceType: true, recurrenceTimes: true, recurrenceDays: true, lastExecutedAt: true }
    });

    if (!task) throw new Error('Task not found');

    const updateData: Record<string, unknown> = { lastExecutedAt: new Date(), updatedAt: new Date() };

    if (task.isRecurring && task.recurrenceType) {
      const taskData = {
        isRecurring: task.isRecurring,
        recurrenceType: task.recurrenceType,
        recurrenceTimes: task.recurrenceTimes ? JSON.parse(task.recurrenceTimes) : null,
        recurrenceDays: task.recurrenceDays ? JSON.parse(task.recurrenceDays) : null,
        lastExecutedAt: new Date()
      };
      updateData.nextExecutionAt = this.calculateNextExecution(taskData);
    } else {
      updateData.nextExecutionAt = null;
    }
    
    sseService.broadcast('task_updated', updateData);
    
    return await prisma.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        subtasks: { select: { id: true, title: true, isCompleted: true } },
        project: true, status: true, priority: true
      }
    });
  }

  calculateNextExecution(taskData: Record<string, unknown>): Date | null {
    const now = new Date();
    const lastExecuted = (taskData.lastExecutedAt as Date) || now;
    if (!taskData.recurrenceType) return null;

    switch (taskData.recurrenceType) {
      case 'daily': return this.calculateNextDailyExecution(lastExecuted, taskData.recurrenceTimes as string[]);
      case 'weekly': return this.calculateNextWeeklyExecution(lastExecuted, taskData.recurrenceDays as number[], taskData.recurrenceTimes as string[]);
      case 'monthly': return this.calculateNextMonthlyExecution(lastExecuted, taskData.recurrenceTimes as string[]);
      default: return null;
    }
  }

  calculateNextDailyExecution(lastExecuted: Date, recurrenceTimes: string[] | null): Date {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    if (!recurrenceTimes || !Array.isArray(recurrenceTimes) || recurrenceTimes.length === 0) {
      const next = new Date(lastExecuted);
      next.setDate(next.getDate() + 1);
      return next;
    }

    const times = recurrenceTimes.map((time: string) => {
      const [hours, minutes] = time.split(':').map(Number);
      const date = new Date(today);
      date.setHours(hours, minutes, 0, 0);
      return date;
    }).sort((a: Date, b: Date) => a.getTime() - b.getTime());

    for (const time of times) {
      if (time > now) return time;
    }

    const firstTimeTomorrow = new Date(times[0]);
    firstTimeTomorrow.setDate(firstTimeTomorrow.getDate() + 1);
    return firstTimeTomorrow;
  }

  calculateNextWeeklyExecution(lastExecuted: Date, recurrenceDays: number[] | null, recurrenceTimes: string[] | null): Date {
    const now = new Date();
    const today = now.getDay();
    
    if (!recurrenceDays || !Array.isArray(recurrenceDays) || recurrenceDays.length === 0) {
      const next = new Date(lastExecuted);
      next.setDate(next.getDate() + 7);
      return next;
    }

    const days = recurrenceDays.map(Number).sort((a, b) => a - b);
    for (const day of days) {
      if (day > today) return this.calculateDateTimeForDay(day, recurrenceTimes, now);
    }

    const nextWeek = new Date(now);
    nextWeek.setDate(nextWeek.getDate() + 7 - today + days[0]);
    return this.calculateDateTimeForDay(days[0], recurrenceTimes, nextWeek);
  }

  calculateNextMonthlyExecution(lastExecuted: Date, recurrenceTimes: string[] | null): Date {
    const next = new Date(lastExecuted);
    next.setMonth(next.getMonth() + 1);
    if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
      const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
      next.setHours(hours, minutes, 0, 0);
    }
    return next;
  }

  calculateDateTimeForDay(dayOfWeek: number, recurrenceTimes: string[] | null, baseDate: Date): Date {
    const date = new Date(baseDate);
    const currentDay = date.getDay();
    const daysToAdd = (dayOfWeek - currentDay + 7) % 7;
    date.setDate(date.getDate() + daysToAdd);
    
    if (recurrenceTimes && Array.isArray(recurrenceTimes) && recurrenceTimes.length > 0) {
      const [hours, minutes] = recurrenceTimes[0].split(':').map(Number);
      date.setHours(hours, minutes, 0, 0);
    } else {
      date.setHours(baseDate.getHours(), baseDate.getMinutes(), 0, 0);
    }
    return date;
  }

  async getNextTaskForUser(nickname: string): Promise<Record<string, unknown> | null> {
    const now = new Date();
    const [user, aiStatuses] = await Promise.all([
      prisma.user.findUnique({ where: { nickname } }),
      prisma.status.findMany({ where: { visibleToAi: true }, select: { id: true } })
    ]);

    if (!user || aiStatuses.length === 0) return null;
    const statusIds = aiStatuses.map((s: { id: string }) => s.id);

    const tasks = await prisma.task.findMany({
      where: {
        assignedToId: user.id, isCompleted: false, statusId: { in: statusIds },
        project: { ativo: true, status: true },
        OR: [{ isRecurring: false }, { isRecurring: true, nextExecutionAt: { lte: now } }, { isRecurring: true, nextExecutionAt: null }]
      },
      include: {
        priority: true, status: true,
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
            agent: true, 
            regras: true, 
            frontendPath: true, 
            frontendPort: true, 
            backendPath: true, 
            backendPort: true, 
            repositoryUrl: true, 
            pastaBase: true, 
            frontendBuildCmd: true, 
            backendBuildCmd: true, 
            frontendTestCommand: true, 
            backendTestCommand: true 
          }
        },
        dependents: { 
          include: { 
            task: { 
              include: { 
                subtasks: { 
                  select: { 
                    id: true, 
                    title: true, 
                    isCompleted: true 
                  } 
                }, 
                priority: true, 
                status: true 
              } 
            } 
          } 
        }
      }
    });

    let playableTasks: Record<string, unknown>[] = [];
    try {
      playableTasks = tasks.filter((t: any) => t.dependents.every((dep: any) => dep.task && dep.task.status && dep.task.status.isFinalState));
    } catch (error) {
      return null;
    }
    
    if (playableTasks.length === 0) return null;

    playableTasks.sort((a: any, b: any) => {
      if (a.isRecurring && !b.isRecurring) return -1;
      if (!a.isRecurring && b.isRecurring) return 1;
      if (a.isRecurring && b.isRecurring) {
        const dateA = a.nextExecutionAt || a.createdAt;
        const dateB = b.nextExecutionAt || b.createdAt;
        return dateA.getTime() - dateB.getTime();
      }
      if (a.priority.weight !== b.priority.weight) return b.priority.weight - a.priority.weight;
      return (a.deadline || a.createdAt).getTime() - (b.deadline || b.createdAt).getTime();
    });
   
    const nextTask = playableTasks[0];
    if (!nextTask) return null;
    return nextTask;
  }

  async finalizeTask(taskId: string, userId: string | undefined, executionNotes: string | null = null): Promise<Record<string, unknown>> {
    const existingTask = await prisma.task.findUnique({ where: { id: taskId } });
    if (!existingTask) throw new Error(`Task with ID ${taskId} not found`);

    let actionUserId = userId || existingTask.assignedToId || existingTask.createdById;
    if (actionUserId) {
      try {
        const userExists = await prisma.user.findUnique({ where: { id: actionUserId }, select: { id: true } });
        if (!userExists) {
          const fallbackUser = await prisma.user.findFirst({ select: { id: true } });
          if (fallbackUser) actionUserId = fallbackUser.id;
          else actionUserId = null;
        }
      } catch (userCheckError) {
        actionUserId = null;
      }
    }

    if (existingTask.isRecurring) {
      const firstStatus = await prisma.status.findFirst({ orderBy: { order: 'asc' } });
      if (!firstStatus) throw new Error('Nenhum status configurado no sistema.');

      const taskDataForCalc = { ...existingTask, lastExecutedAt: new Date() };
      const nextExecutionAt = this.calculateNextExecution(taskDataForCalc);

      const transaction: unknown[] = [
        prisma.task.update({
          where: { id: taskId },
          data: { statusId: firstStatus.id, isExecuting: false, lastExecutedAt: new Date(), nextExecutionAt: nextExecutionAt, isCompleted: false },
          include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, project: true, status: true, priority: true }
        })
      ];
      
      let historyRecord = null;
      if (actionUserId) {
        transaction.push(
          prisma.taskHistory.create({
            data: { taskId: taskId, userId: actionUserId, oldStatusId: existingTask.statusId, newStatusId: firstStatus.id, notes: executionNotes || 'Execução de rotina concluída. Tarefa reiniciada.' }
          })
        );
      }
      
      const transactionResults = await prisma.$transaction(transaction);
      const updatedTask = transactionResults[0];
      historyRecord = actionUserId ? transactionResults[1] : null;

      try {
        const project = await prisma.project.findUnique({ where: { id: existingTask.projectId }, select: { frontendPath: true, backendPath: true } });
        if (project?.frontendPath) await this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
        if (project?.backendPath) await this.checkAndCommit(project.backendPath, taskId, existingTask.title);
      } catch (gitError) {}

      try {
        const user = await prisma.user.findUnique({ where: { id: actionUserId } });
        if (user) {
          const projectName = updatedTask.project?.name || 'Projeto desconhecido';
          const userName = user.name || 'Usuário desconhecido';
          const taskTitle = updatedTask.title || 'Tarefa sem título';
          const nextExecution = nextExecutionAt ? new Date(nextExecutionAt).toLocaleString('pt-BR') : 'Não agendada';
          let message = `🔄 *TAREFA RECURSIVA REINICIADA!*\n\n*Tarefa:* ${taskTitle}\n*Projeto:* ${projectName}\n*Executada por:* ${userName}\n*Próxima execução:* ${nextExecution}\n`;
          if (executionNotes && executionNotes.trim() !== '') message += `\n*Notas:* ${executionNotes.substring(0, 200)}${executionNotes.length > 200 ? '...' : ''}\n`;
          message += `\n📅 *Data:* ${new Date().toLocaleString('pt-BR')}\n🔗 *ID:* ${taskId.substring(0, 8)}...`;
          await NotificationService.sendTelegramNotification(message);
        }
      } catch (notificationError) {}

      try {
        await taskHierarchyService.updateHierarchyOnExecutionChange(taskId, false);
      } catch (err) {}
    
      sseService.broadcast('task_updated', updatedTask);
    
      return { task: updatedTask, status: firstStatus, history: historyRecord, isRecurringReset: true };
    }

    const finalStatus = await prisma.status.findFirst({ where: { isFinalState: true }, orderBy: { order: 'asc' } });
    if (!finalStatus) throw new Error('Nenhum status final configurado no sistema.');

    const transaction: unknown[] = [
      prisma.task.update({
        where: { id: taskId },
        data: { statusId: finalStatus.id, isCompleted: false, isExecuting: false, lastExecutedAt: new Date(), nextExecutionAt: null },
        include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, project: true, status: true, priority: true }
      })
    ];
    
    if (actionUserId) {
      transaction.push(
        prisma.taskHistory.create({
          data: { taskId: taskId, userId: actionUserId, oldStatusId: existingTask.statusId, newStatusId: finalStatus.id, notes: executionNotes || 'Tarefa finalizada.' }
        })
      );
    }

    let finalizedAncestors: any[] = [];
    const checkAndFinalizeAncestors = async (currentTaskId: string, userId: string | null, finalStatusId: string, transactionArray: unknown[]) => {
      const ancestorsToFinalize: any[] = [];
      
      const checkAncestor = async (tId: string) => {
        const task = await prisma.task.findUnique({ where: { id: tId }, select: { parentTaskId: true } });
        if (!task || !task.parentTaskId) return;
        
        const parentTaskId = task.parentTaskId;
        const allSubtasks = await prisma.task.findMany({ where: { parentTaskId: parentTaskId }, include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, status: true } });
        const allSubtasksFinalized = allSubtasks.every((subtask: any) => subtask.id === tId || (subtask.status && subtask.status.isFinalState));

        if (allSubtasksFinalized && allSubtasks.length > 0) {
          const parentTask = await prisma.task.findUnique({ where: { id: parentTaskId }, include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, status: true } });
          if (parentTask && (!parentTask.status || !parentTask.status.isFinalState)) {
            ancestorsToFinalize.push({ task: parentTask, parentTaskId: parentTaskId });
            await checkAncestor(parentTaskId);
          } else if (parentTask && parentTask.status && parentTask.status.isFinalState) {
            await checkAncestor(parentTaskId);
          }
        }
      };
      
      await checkAncestor(currentTaskId);
      
      for (const ancestor of ancestorsToFinalize) {
        const { task: parentTask, parentTaskId } = ancestor;
        transactionArray.push(prisma.task.update({ where: { id: parentTaskId }, data: { statusId: finalStatusId, isCompleted: false, isExecuting: false, lastExecutedAt: new Date(), nextExecutionAt: null }, include: { subtasks: { select: { id: true, title: true, isCompleted: true } }, project: true, status: true, priority: true } }));
        if (userId) {
          transactionArray.push(prisma.taskHistory.create({ data: { taskId: parentTaskId, userId: userId, oldStatusId: parentTask.statusId, newStatusId: finalStatusId, notes: `Tarefa ancestral finalizada automaticamente porque todas as subtasks foram concluídas.` } }));
        }
      }
      return ancestorsToFinalize.length;
    };

    if (existingTask.parentTaskId) {
      await checkAndFinalizeAncestors(taskId, actionUserId, finalStatus.id, transaction);
    }

    const transactionResults = await prisma.$transaction(transaction);
    const updatedTask = transactionResults[0];
    const historyRecord = transactionResults.length > 1 ? transactionResults[1] : null;
    
    const ancestorsFinalized = [];
    const ancestorsHistory = [];
    const startIndex = historyRecord ? 2 : 1;
    
    for (let i = startIndex; i < transactionResults.length; i += 2) {
      if (i < transactionResults.length) ancestorsFinalized.push(transactionResults[i]);
      if (i + 1 < transactionResults.length) ancestorsHistory.push(transactionResults[i + 1]);
    }
    
    try {
      const project = await prisma.project.findUnique({ where: { id: existingTask.projectId }, select: { frontendPath: true, backendPath: true } });
      if (project?.frontendPath) await this.checkAndCommit(project.frontendPath, taskId, existingTask.title);
      if (project?.backendPath) await this.checkAndCommit(project.backendPath, taskId, existingTask.title);
    } catch (gitError) {}

    try {
      const user = await prisma.user.findUnique({ where: { id: actionUserId } });
      if (user) {
        await NotificationService.sendTaskCompletedNotification(updatedTask, user, executionNotes);
      }
      if (ancestorsFinalized.length > 0) {
        for (const ancestorTask of ancestorsFinalized) {
          const allSubtasks = await prisma.task.findMany({ where: { parentTaskId: (ancestorTask as any).id }, select: { id: true, title: true, status: true } });
          await NotificationService.sendParentTaskAutoCompletedNotification(ancestorTask, allSubtasks);
        }
      }
    } catch (notificationError) {}

    try {
      await taskHierarchyService.updateHierarchyOnExecutionChange(taskId, false);
      for (const ancestor of ancestorsFinalized) {
        await taskHierarchyService.updateHierarchyOnExecutionChange((ancestor as any).id, false);
      }
    } catch (err) {}
    
    sseService.broadcast('task_updated', updatedTask);
    if (typeof ancestorsFinalized !== 'undefined' && Array.isArray(ancestorsFinalized)) {
      for (const ancestor of ancestorsFinalized) {
        sseService.broadcast('task_updated', ancestor);
      }
    }
    
    return {
      task: updatedTask, status: finalStatus, history: historyRecord,
      ancestorsFinalized: ancestorsFinalized, ancestorsHistory: ancestorsHistory,
      parentTaskFinalized: ancestorsFinalized.length > 0 ? ancestorsFinalized[0] : null,
      parentHistory: ancestorsHistory.length > 0 ? ancestorsHistory[0] : null,
      isRecurringReset: false
    };
  }
}

export default new TaskService();
