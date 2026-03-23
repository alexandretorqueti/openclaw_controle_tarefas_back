/**
 * Orchestrator principal que executa uma tarefa completa usando o pipeline de steps.
 * Substitui o método `executeTask` do TaskExecutionService.
 */
declare const container: any;
declare class TaskExecutionOrchestrator {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa uma tarefa completa usando o pipeline de steps
     * @param {Object} task - Tarefa a ser executada
     * @param {string} userId - ID do usuário
     * @param {Object} config - Configuração do sistema
     * @returns {Promise<Object>} Resultado da execução
     */
    executeTask(task: any, userId: any, config: any): Promise<{
        success: any;
        executionNotes: any;
        taskId: any;
    }>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa a ser executada
     * @param {string} userId - ID do usuário
     * @param {Object} config - Configuração do sistema
     * @returns {Promise<Object>} Resultado da execução
     */
    static execute(task: any, userId: any, config: any): Promise<any>;
}
