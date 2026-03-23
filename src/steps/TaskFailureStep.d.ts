/**
 * Step responsável por tratar falhas na execução de tarefas.
 * Inclui logging, comentários, reatribuição, limpeza de locks e movimentação de arquivos.
 */
declare const container: any;
declare class TaskFailureStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Cria instância do LockService com configuração
     * @private
     */
    _createLockService(): any;
    /**
     * Cria instância do MonitorStateService com configuração
     * @private
     */
    _createStateService(): any;
    /**
     * Cria instância do TaskFileService
     * @private
     */
    _createTaskFileService(): any;
    /**
     * Executa o step de tratamento de falha
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa que falhou
     * @param {Error} context.error - Erro que ocorreu
     * @param {string} context.userId - ID do usuário (opcional)
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context: any): Promise<any>;
    /**
     * Tenta reatribuir tarefa para o usuário 'alexandre'
     * @private
     */
    _tryReassignTask(task: any, apiUrl: any): Promise<void>;
    /**
     * Libera lock e limpa estado de execução
     * @private
     */
    _cleanupExecutionState(task: any): Promise<void>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa que falhou
     * @param {Error} error - Erro que ocorreu
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static handleFailure(task: any, error: any, userId?: any): Promise<any>;
}
