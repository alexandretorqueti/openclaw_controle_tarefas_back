declare const PrismaClient: any;
declare const ErrorMiddleware: any;
declare const prisma: any;
declare class TaskExecutionController {
    /**
     * Lista logs de execução de uma tarefa específica
     * @param {Object} req - Request
     * @param {Object} res - Response
     */
    static getTaskExecutions: any;
    /**
     * Obtém detalhes de um log específico
     * @param {Object} req - Request
     * @param {Object} res - Response
     */
    static getExecutionLog: any;
    /**
     * Obtém estatísticas de execução de uma tarefa
     * @param {Object} req - Request
     * @param {Object} res - Response
     */
    static getExecutionStats: any;
}
