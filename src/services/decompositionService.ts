// src/services/DecompositionService.ts

import prisma from "./prismaService";
import { Logger, LOG_LEVELS, ERROR_TYPES } from '../utils/logger';
import sseService from "./sseService";

// Interface para definir a estrutura de uma subtarefa recebida
interface SubtaskInput {
  title: string;
  description?: string;
  domain: 'BACKEND' | 'FRONTEND';
  statusId: string;
  priorityId: string;
  userId: string;
  deadline?: string | Date;
  projectId?: string;
}

/**
 * Serviço de decomposição de tarefas
 * Transforma um array de tarefas em tarefas encadeadas com dependências sequenciais
 */
class DecompositionService {
  /**
   * Decompõe uma tarefa pai em subtarefas sequenciais
   */
  async decompose(parentTaskId: string, subtasksArray: SubtaskInput[]): Promise<any> {
    try {
      if (!parentTaskId) throw new Error('parentTaskId é obrigatório');
      if (!Array.isArray(subtasksArray) || subtasksArray.length === 0) {
        throw new Error('subtasksArray deve ser um array não vazio');
      }

      await Logger.logInfo({ message: `Iniciando decomposição da tarefa ${parentTaskId} com ${subtasksArray.length} subtarefas` });

      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        select: { id: true, isDecomposed: true, projectId: true }
      });

      if (!parentTask) throw new Error(`Tarefa pai ${parentTaskId} não encontrada`);
      if (parentTask.isDecomposed) throw new Error(`Tarefa ${parentTaskId} já está decomposta`);

      // Validar cada subtarefa antes de abrir a transação
      subtasksArray.forEach((subtask, i) => {
        this.validateSubtask(subtask, i, parentTask.projectId);
      });

      // Executar decomposição em transação para garantir atomicidade
      const result = await prisma.$transaction(async (tx) => {
        const createdSubtasks = [];
        let previousTaskId: string | null = null;

        for (let i = 0; i < subtasksArray.length; i++) {
          const subtask = subtasksArray[i];
          
          const created = await tx.task.create({
            data: {
              title: subtask.title,
              description: subtask.description || '',
              domain: subtask.domain,
              projectId: parentTask.projectId,
              parentTaskId: parentTaskId,
              statusId: subtask.statusId,
              priorityId: subtask.priorityId,
              createdById: subtask.userId,
              assignedToId: subtask.userId,
              deadline: subtask.deadline ? new Date(subtask.deadline) : new Date(),
              position: i,
              isAtomic: false, 
              isDecomposed: false,
              isCompleted: false
            }
          });

          createdSubtasks.push(created);

          // Criar dependência sequencial (DependentTaskId depende de TaskId)
          if (previousTaskId) {
            await tx.dependency.create({
              data: { 
                taskId: previousTaskId, 
                dependentTaskId: created.id,
                type: 'SEQUENTIAL'
              }
            });
          }

          previousTaskId = created.id;
        }

        // Marcar a tarefa pai como decomposta
        await tx.task.update({ 
          where: { id: parentTaskId }, 
          data: { 
            isDecomposed: true,
            isAtomic: false 
          } 
        });

        return {
          parentTaskId,
          subtasksCreated: createdSubtasks.length,
          subtasks: createdSubtasks,
          dependenciesCreated: subtasksArray.length - 1
        };
      });

      // Notificações SSE (Fora da transação para não travar o banco)
      this._emitSseUpdates(parentTaskId, result.subtasks).catch(err => 
        Logger.logError(err, {} as any, {} as any, ERROR_TYPES.SSE)
      );

      await Logger.logInfo({ message: `Decomposição concluída: ${result.subtasksCreated} subtarefas para tarefa ${parentTaskId}` });
      return result;

    } catch (error: any) {
      await Logger.logError(error, {} as any, {} as any, ERROR_TYPES.CAN_DECOMPOSE_ERROR);
      throw error;
    }
  }

  /**
   * Valida uma subtarefa individual
   */
  private validateSubtask(subtask: SubtaskInput, index: number, projectId: string | null): void {
    if (!subtask.title || typeof subtask.title !== 'string') {
      throw new Error(`Subtask[${index}]: título é obrigatório`);
    }
    if (!subtask.domain || !['BACKEND', 'FRONTEND'].includes(subtask.domain)) {
      throw new Error(`Subtask[${index}]: domain deve ser 'BACKEND' ou 'FRONTEND'`);
    }
    if (!subtask.statusId) throw new Error(`Subtask[${index}]: statusId é obrigatório`);
    if (!subtask.userId) throw new Error(`Subtask[${index}]: userId é obrigatório`);

    if (subtask.projectId && subtask.projectId !== projectId) {
      throw new Error(`Subtask[${index}]: projectId não corresponde ao projeto pai`);
    }
  }

  /**
   * Helper privado para emissão de eventos SSE
   */
  private async _emitSseUpdates(parentTaskId: string, subtasks: any[]): Promise<void> {
    for (const subtask of subtasks) {
      sseService.broadcast('task_created', subtask);
    }
    
    const parentWithDetails = await prisma.task.findUnique({
      where: { id: parentTaskId },
      include: {
        project: true,
        status: true,
        priority: true,
        subtasks: { select: { id: true, title: true, isCompleted: true } }
      }
    });
    
    if (parentWithDetails) {
      sseService.broadcast('task_updated', parentWithDetails);
    }
  }

  /**
   * Verifica se uma tarefa pode ser decomposta
   */
  async canDecompose(taskId: string): Promise<any> {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: { id: true, isDecomposed: true, isAtomic: true, isCompleted: true, projectId: true, title: true }
      });

      if (!task) return { canDecompose: false, reason: 'Tarefa não encontrada' };
      if (task.isDecomposed) return { canDecompose: false, reason: 'Tarefa já decomposta' };
      if (task.isAtomic) return { canDecompose: false, reason: 'Tarefa marcada como atômica' };
      if (task.isCompleted) return { canDecompose: false, reason: 'Tarefa já concluída' };

      return { canDecompose: true, task };
    } catch (error: any) {
      await Logger.logError(error, {} as any, {} as any, ERROR_TYPES.DECOMPOSITION_ERROR);
      throw error;
    }
  }

  /**
   * Obtém as subtarefas de uma tarefa decomposta
   */
  async getSubtasks(parentTaskId: string): Promise<any[]> {
    return prisma.task.findMany({
      where: { parentTaskId, isCompleted: false },
      include: {
        status: true,
        priority: true,
        dependencies: { include: { dependentTask: true } }
      },
      orderBy: { position: 'asc' }
    });
  }
}

export default new DecompositionService();