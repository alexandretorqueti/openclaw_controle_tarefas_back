declare const fs: any;
declare const path: any;
declare const fileExists: any, safeReadFile: any, safeWriteFile: any;
declare const safeParse: any, safeStringify: any;
declare class MonitorStateService {
    constructor(tasksDir: any);
    /**
     * Le o estado atual do monitor
     * @returns {Promise<Object>}
     */
    readState(): Promise<any>;
    /**
     * Salva o estado do monitor
     * @param {Object} state - Estado a salvar
     * @returns {Promise<boolean>}
     */
    saveState(state: any): Promise<any>;
    /**
     * Registra uma tarefa como ativa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<void>}
     */
    registerActiveTask(taskId: any): Promise<void>;
    /**
     * Remove uma tarefa do estado ativo
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<void>}
     */
    cleanupTask(taskId: any): Promise<void>;
    /**
     * Obtem informacoes de uma tarefa ativa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<Object|null>}
     */
    getActiveTask(taskId: any): Promise<any>;
    /**
     * Obtem todas as tarefas ativas
     * @returns {Promise<Object>}
     */
    getActiveTasks(): Promise<any>;
    /**
     * Obtem o tempo de execucao de uma tarefa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<number|null>} Tempo em ms
     */
    getTaskElapsedTime(taskId: any): Promise<number>;
    /**
     * Verifica se uma tarefa esta em timeout
     * @param {string} taskId - ID da tarefa
     * @param {number} timeoutMs - Tempo limite em ms
     * @returns {Promise<boolean>}
     */
    isTaskTimedOut(taskId: any, timeoutMs: any): Promise<boolean>;
    /**
     * Limpa completamente o estado
     * @returns {Promise<void>}
     */
    clearState(): Promise<void>;
}
