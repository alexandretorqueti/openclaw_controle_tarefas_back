/**
 * Step responsável por preparar o contexto para execução de tarefas.
 * Inclui análise de escopo, preparação de arquivos, geração de prompts e snapshot inicial.
 */
declare const container: any;
declare class SetupContextStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa o step de preparação de contexto
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa a ser executada
     * @param {string} context.userId - ID do usuário
     * @returns {Promise<Object>} Contexto atualizado com setup completo
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa a ser preparada
     * @param {string} userId - ID do usuário
     * @param {Object} config - Configuração (opcional, usa container por padrão)
     * @returns {Promise<Object>} Resultado do setup
     */
    static setupContext(task: any, userId: any, config?: any): Promise<any>;
}
