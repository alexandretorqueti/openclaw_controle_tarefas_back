/**
 * Step responsável por tratar sucesso na execução de tarefas.
 * Inclui logging, finalização na API, movimentação de arquivos e liberação de lock.
 */
declare const container: any;
declare class TaskSuccessStep {
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
     * Executa o step de tratamento de sucesso
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa executada com sucesso
     * @param {Object} context.executionResult - Resultado da execução
     * @param {string} context.userId - ID do usuário (opcional, usa config.MY_USER_ID por padrão)
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa executada com sucesso
     * @param {Object} executionResult - Resultado da execução
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static handleSuccess(task: any, executionResult: any, userId?: any): Promise<any>;
}
