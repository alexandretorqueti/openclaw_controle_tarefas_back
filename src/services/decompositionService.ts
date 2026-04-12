import prisma from './prismaService';
import { Logger } from '../utils/logger';
import sseService from './sseService';

interface Subtask {
  title: string;
  description?: string;
  domain: 'BACKEND' | 'FRONTEND';
  statusId: string;
  priorityId: string;
  userId: string;
  deadline?: string | Date;
  projectId?: string;
}

class DecompositionService {
  /**
   * Decompõe uma tarefa pai em subtarefas sequenciais
   */
  async decompose(parentTaskId: string, subtasksArray: Subtask[]) {
    try {
      if (!parentTaskId) {
        throw new Error('parentTaskId é obrigatório');
      }

      if (!Array.isArray(subtasksArray) || subtasksArray.length === 0) {
        throw new Error('subtasksArray deve ser um array não vazio');
      }

      Logger.logInfo(`Iniciando decomposição da tarefa ${parentTaskId} com ${subtasksArray.length} subtarefas`);

      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        include: { project: true }
      });

      if (!parentTask) {
        throw new Error(`Tarefa pai ${parentTaskId} não encontrada`);
      }

      if (parentTask.isDecomposed) {
        throw new Error(`Tarefa ${parentTaskId} já está decomposta`);
      }

      // Validar cada subtarefa
      subtasksArray.forEach((subtask, i) => this.validateSubtask(subtask, i, parentTask.projectId));

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
              isCompleted: false,
              totalSubtasks: 0
            }
          });

          createdSubtasks.push(created);

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

        await tx.task.update({ 
          where: { id: parentTaskId }, 
          data: { 
            isDecomposed: true,
            isAtomic: false,
            totalSubtasks: createdSubtasks.length
          } 
        });

        return {
          parentTaskId,
          subtasksCreated: createdSubtasks.length,
          subtasks: createdSubtasks,
          dependenciesCreated: subtasksArray.length - 1
        };
      });

      try {
        for (const subtask of result.subtasks) {
          sseService.broadcast('task_created', subtask);
        }
        
        const parentTaskWithSubtasks = await prisma.task.findUnique({
          where: { id: parentTaskId },
          include: {
            project: { select: { id: true, name: true } },
            status: true,
            priority: true,
            createdBy: { select: { id: true, name: true, email: true, avatarUrl: true } },
            assignedTo: { select: { id: true, name: true, email: true, avatarUrl: true } },
            subtasks: { select: { id: true, title: true, isCompleted: true } }
          }
        });
        
        if (parentTaskWithSubtasks) {
          sseService.broadcast('task_updated', parentTaskWithSubtasks);
        }
      } catch (sseError: any) {
        Logger.logError(`Erro ao emitir eventos SSE para decomposição: ${sseError.message}`);
      }

      Logger.logInfo(`Decomposição concluída para tarefa ${parentTaskId}`);
      return result;

    } catch (error: any) {
      Logger.logError(`Erro na decomposição da tarefa ${parentTaskId}: ${error.message}`);
      throw error;
    }
  }

  private validateSubtask(subtask: Subtask, index: number, projectId: string) {
    if (!subtask.title) throw new Error(`Subtask[${index}]: título é obrigatório`);
    if (!['BACKEND', 'FRONTEND'].includes(subtask.domain)) throw new Error(`Subtask[${index}]: domain inválido`);
    if (!subtask.statusId) throw new Error(`Subtask[${index}]: statusId é obrigatório`);
    if (!subtask.priorityId) throw new Error(`Subtask[${index}]: priorityId é obrigatório`);
    if (!subtask.userId) throw new Error(`Subtask[${index}]: userId é obrigatório`);
    if (subtask.projectId && subtask.projectId !== projectId) throw new Error(`Subtask[${index}]: projectId divergente`);
  }

  async canDecompose(taskId: string) {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, isDecomposed: true, isAtomic: true, isCompleted: true, title: true, projectId: true }
    });

    if (!task) return { canDecompose: false, reason: 'Tarefa não encontrada' };
    if (task.isDecomposed) return { canDecompose: false, reason: 'Tarefa já decomposta' };
    if (task.isAtomic) return { canDecompose: false, reason: 'Tarefa marcada como atômica' };
    if (task.isCompleted) return { canDecompose: false, reason: 'Tarefa já concluída' };

    return { canDecompose: true, task };
  }

  async getSubtasks(parentTaskId: string) {
    return await prisma.task.findMany({
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
