/**
 * Step responsável por finalizar a execução da tarefa, salvar logs e conteúdos
 * gerados no banco de dados e consolidar o resultado final.
 */
declare const container: any;
declare class TeardownStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa o step de finalização (teardown)
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.executionLogData - Dados do log de execução (para finalizar)
     * @param {Object} context.contractResult - Resultado final do contrato (do DeveloperLoopOrchestrator)
     * @param {Object} context.files - Arquivos preparados
     * @param {Object} context.config - Configuração
     * @param {string} context.architectPlan - Plano do arquiteto
     * @returns {Promise<Object>} Contexto atualizado com resultado final
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado final
     */
    static finalizeTask(context: any): Promise<any>;
}
