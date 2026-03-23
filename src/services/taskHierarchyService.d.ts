declare const prisma: any;
declare class TaskHierarchyService {
    /**
     * Marca todos os ancestrais de uma tarefa como tendo filho em execução
     * @param {string} taskId - ID da tarefa que está sendo executada
     * @returns {Promise<void>}
     */
    markAncestorsAsChildExecuting(taskId: any): Promise<void>;
    /**
     * Desmarca todos os ancestrais de uma tarefa (remove hasChildExecuting)
     * Verifica se ainda há outros descendentes em execução antes de desmarcar
     * @param {string} taskId - ID da tarefa que parou de executar
     * @returns {Promise<void>}
     */
    unmarkAncestorsAsChildExecuting(taskId: any): Promise<void>;
    /**
     * Atualiza um ancestral apenas se não tiver mais descendentes em execução
     * @param {string} ancestorId - ID do ancestral a verificar
     * @returns {Promise<void>}
     */
    updateAncestorIfNoExecutingChildren(ancestorId: any): Promise<void>;
    /**
     * Conta quantos descendentes de uma tarefa estão em execução
     * @param {string} taskId - ID da tarefa ancestral
     * @returns {Promise<number>}
     */
    countExecutingDescendants(taskId: any): Promise<number>;
    /**
     * Obtém todos os ancestrais de uma tarefa (pai, avô, bisavô, etc.)
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<Array>} Array de tarefas ancestrais
     */
    getTaskAncestors(taskId: any): Promise<any[]>;
    /**
     * Obtém todos os descendentes de uma tarefa (filhos, netos, etc.)
     * @param {string} taskId - ID da tarefa ancestral
     * @returns {Promise<Array>} Array de tarefas descendentes
     */
    getTaskDescendants(taskId: any): Promise<any[]>;
    /**
     * Atualiza a marcação hierárquica quando uma tarefa muda seu estado de execução
     * @param {string} taskId - ID da tarefa
     * @param {boolean} isNowExecuting - Novo estado de execução
     * @returns {Promise<void>}
     */
    updateHierarchyOnExecutionChange(taskId: any, isNowExecuting: any): Promise<void>;
}
