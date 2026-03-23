/**
 * Step responsável pela análise e planejamento do arquiteto.
 * O arquiteto analisa a tarefa, gera um plano de ação e pode até executar a tarefa.
 * Inclui validação inteligente de evidências e decisão de fluxo.
 */
declare const container: any;
declare class ArchitectPlanningStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa o step de planejamento do arquiteto
     * @param {Object} context - Contexto do pipeline (deve conter dados do SetupContextStep)
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.files - Arquivos preparados
     * @param {Map} context.initialSnapshot - Snapshot inicial
     * @param {Object} context.config - Configuração
     * @param {Object} context.analysisPlan - Plano de análise
     * @param {string} context.commentsSection - Seção de comentários
     * @param {string} context.developerPrompt - Prompt do desenvolvedor
     * @param {string} context.currentInput - Prompt atual
     * @returns {Promise<Object>} Contexto atualizado com análise do arquiteto
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo (deve conter todos os dados necessários)
     * @returns {Promise<Object>} Resultado do planejamento
     */
    static planArchitect(context: any): Promise<any>;
}
