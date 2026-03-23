/**
 * Step responsável por validar o ecossistema do projeto (build, testes, etc.)
 * Executa após contrato cumprido para garantir que as alterações não quebraram o sistema.
 */
declare const container: any;
declare class EcosystemValidationStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa a validação do ecossistema
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.config - Configuração
     * @param {Object} context.analysisPlan - Plano de análise (para determinar tipo de tarefa)
     * @param {Object} context.contractResult - Resultado da verificação de contrato
     * @param {string} context.actualDoneFilePath - Caminho do arquivo .done
     * @returns {Promise<Object>} Contexto atualizado com resultado da validação
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado da validação
     */
    static validateEcosystem(context: any): Promise<any>;
}
