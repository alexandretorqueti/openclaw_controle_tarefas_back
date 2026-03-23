/**
 * Step responsável por verificar timeout de tarefas em execução.
 * Mata processos que excederam o limite crítico e limpa o sistema.
 */
declare const container: any;
declare class TaskTimeoutCheckStep {
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
     * Executa o step de verificação de timeout
     * @param {Object} context - Contexto do pipeline
     * @param {number} context.pid - PID do processo a verificar
     * @param {number} context.taskTimeoutMs - Timeout da tarefa em ms (opcional, usa config.TASK_TIMEOUT_MS por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {number} pid - PID do processo a verificar
     * @param {number} taskTimeoutMs - Timeout da tarefa em ms (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static checkTimeout(pid: any, taskTimeoutMs?: any): Promise<any>;
}
