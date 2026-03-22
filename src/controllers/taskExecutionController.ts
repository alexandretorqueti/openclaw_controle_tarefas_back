// Migrado para TypeScript - Fase: Controllers
// Arquivo: taskExecutionController.js

import { PrismaClient } from '@prisma/client';
import ErrorMiddleware from '../middlewares/errorMiddleware';

const prisma = new PrismaClient();

class TaskExecutionController {
  /**
   * Lista logs de execução de uma tarefa específica
   * @param {Object} req - Request
   * @param {Object} res - Response
   */
  static getTaskExecutions = ErrorMiddleware.catchAsync(async (req, res): Promise<any> => {
    const { taskId } = req.params;
    const { limit = 10 } = req.query;

    // Validação do taskId
    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'taskId é obrigatório'
      });
    }

    // Validação do limite
    const parsedLimit = parseInt(limit);
    if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
      return res.status(400).json({
        success: false,
        message: 'limit deve ser um número entre 1 e 100'
      });
    }

    const executions = await prisma.taskExecutionLog.findMany({
      where: { taskId },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            project: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            nickname: true
          }
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: parsedLimit
    });

    res.status(200).json({
      success: true,
      count: executions.length,
      data: executions
    });
  });

  /**
   * Obtém detalhes de um log específico
   * @param {Object} req - Request
   * @param {Object} res - Response
   */
  static getExecutionLog = ErrorMiddleware.catchAsync(async (req, res): Promise<any> => {
    const { id } = req.params;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'ID do log é obrigatório'
      });
    }

    const executionLog = await prisma.taskExecutionLog.findUnique({
      where: { id },
      include: {
        task: {
          select: {
            id: true,
            title: true,
            description: true,
            project: {
              select: {
                id: true,
                name: true,
                description: true
              }
            },
            status: {
              select: {
                id: true,
                name: true,
                colorCode: true
              }
            },
            priority: {
              select: {
                id: true,
                name: true,
                weight: true
              }
            }
          }
        },
        user: {
          select: {
            id: true,
            name: true,
            nickname: true,
            email: true,
            avatarUrl: true
          }
        }
      }
    });

    if (!executionLog) {
      return res.status(404).json({
        success: false,
        message: 'Log de execução não encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: executionLog
    });
  });

  /**
   * Obtém estatísticas de execução de uma tarefa
   * @param {Object} req - Request
   * @param {Object} res - Response
   */
  static getExecutionStats = ErrorMiddleware.catchAsync(async (req, res): Promise<any> => {
    const { taskId } = req.params;

    if (!taskId) {
      return res.status(400).json({
        success: false,
        message: 'taskId é obrigatório'
      });
    }

    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as totalExecutions,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successfulExecutions,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failedExecutions,
        AVG(durationMs) as averageDuration,
        MIN(startedAt) as firstExecution,
        MAX(startedAt) as lastExecution
      FROM task_execution_logs
      WHERE taskId = ${taskId}
    `;

    const recentExecutions = await prisma.taskExecutionLog.findMany({
      where: { taskId },
      select: {
        id: true,
        startedAt: true,
        finishedAt: true,
        success: true,
        durationMs: true,
        model: true
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 5
    });

    res.status(200).json({
      success: true,
      data: {
        ...stats[0],
        recentExecutions
      }
    });
  });
}

export default TaskExecutionController;