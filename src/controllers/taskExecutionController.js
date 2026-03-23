var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
const { PrismaClient } = require('@prisma/client');
const ErrorMiddleware = require('../middlewares/errorMiddleware');
const prisma = new PrismaClient();
class TaskExecutionController {
}
_a = TaskExecutionController;
/**
 * Lista logs de execução de uma tarefa específica
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
TaskExecutionController.getTaskExecutions = ErrorMiddleware.catchAsync((req, res) => __awaiter(_a, void 0, void 0, function* () {
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
    const executions = yield prisma.taskExecutionLog.findMany({
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
}));
/**
 * Obtém detalhes de um log específico
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
TaskExecutionController.getExecutionLog = ErrorMiddleware.catchAsync((req, res) => __awaiter(_a, void 0, void 0, function* () {
    const { id } = req.params;
    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'ID do log é obrigatório'
        });
    }
    const executionLog = yield prisma.taskExecutionLog.findUnique({
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
}));
/**
 * Obtém estatísticas de execução de uma tarefa
 * @param {Object} req - Request
 * @param {Object} res - Response
 */
TaskExecutionController.getExecutionStats = ErrorMiddleware.catchAsync((req, res) => __awaiter(_a, void 0, void 0, function* () {
    const { taskId } = req.params;
    if (!taskId) {
        return res.status(400).json({
            success: false,
            message: 'taskId é obrigatório'
        });
    }
    const stats = yield prisma.$queryRaw `
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
    const recentExecutions = yield prisma.taskExecutionLog.findMany({
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
        data: Object.assign(Object.assign({}, stats[0]), { recentExecutions })
    });
}));
module.exports = TaskExecutionController;
