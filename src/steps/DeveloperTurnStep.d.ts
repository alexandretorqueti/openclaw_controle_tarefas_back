/**
 * Step responsável por executar um turno individual do desenvolvedor.
 * Inclui geração de sessão, execução via OpenClaw e coleta básica de evidências.
 */
declare const container: any;
declare class DeveloperTurnStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa um turno do desenvolvedor
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.files - Arquivos preparados
     * @param {Object} context.config - Configuração
     * @param {number} context.turnNumber - Número do turno (1-indexed)
     * @param {string} context.basePrompt - Prompt base (inclui contexto de dependências)
     * @param {string} context.lastFeedback - Feedback do turno anterior (pode ser null)
     * @param {string} context.backupAgent - Agente de fallback
     * @returns {Promise<Object>} Contexto atualizado com resultado do turno
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado do turno
     */
    static executeTurn(context: any): Promise<any>;
}
