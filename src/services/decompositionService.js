const prisma = require('./prismaService');
const { Logger, LOG_LEVELS } = require('../utils/logger');
const sseService = require('./sseService');
const logger = Logger;
/**
 * Serviço de decomposição de tarefas
 * Transforma um array de tarefas em tarefas encadeadas com dependências sequenciais
 */
class DecompositionService {
  /**
   * Decompõe uma tarefa pai em subtarefas sequenciais
   * @param {string} parentTaskId - ID da tarefa pai
   * @param {Array} subtasksArray - Array de objetos de subtarefas
   * @returns {Promise<Object>} Resultado da decomposição
   */
  async decompose(parentTaskId, subtasksArray) {
    try {
      // Validações iniciais
      if (!parentTaskId) {
        throw new Error('parentTaskId é obrigatório');
      }

      if (!Array.isArray(subtasksArray) || subtasksArray.length === 0) {
        throw new Error('subtasksArray deve ser um array não vazio');
      }

      logger.logInfo(`Iniciando decomposição da tarefa ${parentTaskId} com ${subtasksArray.length} subtarefas`);

      // Verificar se a tarefa pai existe
      const parentTask = await prisma.task.findUnique({
        where: { id: parentTaskId },
        include: { id: true, isDecomposed: true, project: true }
      });

      if (!parentTask) {
        throw new Error(`Tarefa pai ${parentTaskId} não encontrada`);
      }

      if (parentTask.isDecomposed) {
        throw new Error(`Tarefa ${parentTaskId} já está decomposta`);
      }

      // Validar cada subtarefa
      for (let i = 0; i < subtasksArray.length; i++) {
        const subtask = subtasksArray[i];
        this.validateSubtask(subtask, i, parentTask.projectId);
      }

      // Executar decomposição em transação
      const result = await prisma.$transaction(async (tx) => {
        const createdSubtasks = [];
        let previousTaskId = null;

        for (let i = 0; i < subtasksArray.length; i++) {
          const subtask = subtasksArray[i];
          
          // Criar subtarefa
          const created = await tx.task.create({
            data: {
              title: subtask.title,
              description: subtask.description || '',
              domain: subtask.domain, // 'BACKEND' ou 'FRONTEND'
              projectId: parentTask.projectId,
              parentTaskId: parentTaskId,
              statusId: subtask.statusId,
              priorityId: subtask.priorityId,
              createdById: subtask.userId,
              assignedToId: subtask.userId,
              deadline: subtask.deadline ? new Date(subtask.deadline) : new Date(),
              position: i, // Posição na sequência
              isAtomic: false, // Nasce falso para passar pelo Validador
              isDecomposed: false,
              isCompleted: false
            }
          });

          createdSubtasks.push(created);

          // Criar dependência sequencial (exceto para a primeira)
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
            isAtomic: false // Tarefa decomposta não é atômica
          } 
        });

        return {
          parentTaskId,
          subtasksCreated: createdSubtasks.length,
          subtasks: createdSubtasks,
          dependenciesCreated: subtasksArray.length - 1
        };
      });

      // Emitir eventos SSE para atualização em tempo real
      try {
        // Emitir task_created para cada subtarefa criada
        for (const subtask of result.subtasks) {
          sseService.broadcast('task_created', subtask);
        }
        
        // Buscar a tarefa pai com subtarefas incluídas para emitir task_updated
        const parentTaskWithSubtasks = await prisma.task.findUnique({
          where: { id: parentTaskId },
          include: {
            project: {
              select: { id: true, name: true }
            },
            status: true,
            priority: true,
            createdBy: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            assignedTo: {
              select: { id: true, name: true, email: true, avatarUrl: true }
            },
            subtasks: {
              select: { id: true, title: true, isCompleted: true }
            }
          }
        });
        
        if (parentTaskWithSubtasks) {
          sseService.broadcast('task_updated', parentTaskWithSubtasks);
        }
      } catch (sseError) {
        const errorMessage = `Erro ao emitir eventos SSE para decomposição da tarefa ${parentTaskId}: ${sseError.message}`;
        logger.logError(errorMessage);
        // Não falhar a decomposição por causa do SSE
      }

      logger.logInfo(`Decomposição concluída: ${result.subtasksCreated} subtarefas criadas para tarefa ${parentTaskId}`);
      return result;

    } catch (error) {
      const errorMessage = `Erro na decomposição da tarefa ${parentTaskId}: ${error.message}`;
      logger.logError(errorMessage);
      throw error;
    }
  }

  /**
   * Valida uma subtarefa individual
   * @param {Object} subtask - Objeto da subtarefa
   * @param {number} index - Índice no array
   * @param {string} projectId - ID do projeto
   */
  validateSubtask(subtask, index, projectId) {
    if (!subtask.title || typeof subtask.title !== 'string') {
      throw new Error(`Subtask[${index}]: título é obrigatório e deve ser uma string`);
    }

    if (!subtask.domain || !['BACKEND', 'FRONTEND'].includes(subtask.domain)) {
      throw new Error(`Subtask[${index}]: domain deve ser 'BACKEND' ou 'FRONTEND'`);
    }

    if (!subtask.statusId || typeof subtask.statusId !== 'string') {
      throw new Error(`Subtask[${index}]: statusId é obrigatório`);
    }

    if (!subtask.priorityId || typeof subtask.priorityId !== 'string') {
      throw new Error(`Subtask[${index}]: priorityId é obrigatório`);
    }

    if (!subtask.userId || typeof subtask.userId !== 'string') {
      throw new Error(`Subtask[${index}]: userId é obrigatório`);
    }

    // Se projectId for fornecido na subtask, deve corresponder ao projeto pai
    if (subtask.projectId && subtask.projectId !== projectId) {
      throw new Error(`Subtask[${index}]: projectId não corresponde ao projeto da tarefa pai`);
    }
  }

  /**
   * Verifica se uma tarefa pode ser decomposta
   * @param {string} taskId - ID da tarefa
   * @returns {Promise<Object>} Informações sobre a capacidade de decomposição
   */
  async canDecompose(taskId) {
    try {
      const task = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          isDecomposed: true,
          isAtomic: true,
          isCompleted: true,
          title: true
        },
        include: { project: true }
      });

      if (!task) {
        return { canDecompose: false, reason: 'Tarefa não encontrada' };
      }

      if (task.isDecomposed) {
        return { canDecompose: false, reason: 'Tarefa já decomposta' };
      }

      if (task.isAtomic) {
        return { canDecompose: false, reason: 'Tarefa marcada como atômica' };
      }

      if (task.isCompleted) {
        return { canDecompose: false, reason: 'Tarefa já concluída' };
      }

      return { 
        canDecompose: true, 
        task: {
          id: task.id,
          title: task.title,
          projectId: task.projectId
        }
      };

    } catch (error) {
      const errorMessage = `Erro ao verificar decomposição da tarefa ${taskId}: ${error.message}`;
      logger.logError(errorMessage);
      throw error;
    }
  }

  /**
   * Obtém as subtarefas de uma tarefa decomposta
   * @param {string} parentTaskId - ID da tarefa pai
   * @returns {Promise<Array>} Array de subtarefas
   */
  async getSubtasks(parentTaskId) {
    try {
      const subtasks = await prisma.task.findMany({
        where: { 
          parentTaskId: parentTaskId,
          isCompleted: false
        },
        include: {
          status: true,
          priority: true,
          dependencies: {
            include: {
              dependentTask: true
            }
          }
        },
        orderBy: { position: 'asc' }
      });

      return subtasks;

    } catch (error) {
      const errorMessage = `Erro ao obter subtarefas da tarefa ${parentTaskId}: ${error.message}`;
      logger.logError(errorMessage);
      throw error;
    }
  }
}

module.exports = new DecompositionService();