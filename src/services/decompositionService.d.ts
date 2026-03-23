declare const prisma: any;
declare const Logger: any, LOG_LEVELS: any;
declare const sseService: any;
declare const logger: any;
/**
 * Serviço de decomposição de tarefas
 * Transforma um array de tarefas em tarefas encadeadas com dependências sequenciais
 */
declare class DecompositionService {
    /**
     * Decompõe uma tarefa pai em subtarefas sequenciais
     * @param {string} parentTaskId - ID da tarefa pai
     * @param {Array} subtasksArray - Array de objetos de subtarefas
     * @returns {Promise<Object>} Resultado da decomposição
     */
    decompose(parentTaskId: any, subtasksArray: any): Promise<any>;
    /**
     * Valida uma subtarefa individual
     * @param {Object} subtask - Objeto da subtarefa
     * @param {number} index - Índice no array
     * @param {string} projectId - ID do projeto
     */
    validateSubtask(subtask: any, index: any, projectId: any): void;
    /**
     * Verifica se uma tarefa pode ser decomposta
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<Object>} Informações sobre a capacidade de decomposição
     */
    canDecompose(taskId: any): Promise<{
        canDecompose: boolean;
        reason: string;
        task?: undefined;
    } | {
        canDecompose: boolean;
        task: {
            id: any;
            title: any;
            projectId: any;
        };
        reason?: undefined;
    }>;
    /**
     * Obtém as subtarefas de uma tarefa decomposta
     * @param {string} parentTaskId - ID da tarefa pai
     * @returns {Promise<Array>} Array de subtarefas
     */
    getSubtasks(parentTaskId: any): Promise<any>;
}
