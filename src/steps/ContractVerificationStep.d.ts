/**
 * Step responsável por verificar se o contrato da tarefa foi cumprido.
 * Verifica arquivos .done, relatório, evidências e snapshot changes.
 */
declare const container: any;
declare class ContractVerificationStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa a verificação de contrato
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.files - Arquivos preparados
     * @param {Object} context.config - Configuração
     * @param {Object} context.evidence - Evidências coletadas (do DeveloperTurnStep)
     * @param {Object} context.analysisPlan - Plano de análise
     * @param {Map} context.initialSnapshot - Snapshot inicial
     * @param {string} context.actualDoneFilePath - Caminho real do arquivo .done (pode ser diferente do esperado)
     * @returns {Promise<Object>} Contexto atualizado com resultado da verificação
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado da verificação
     */
    static verifyContract(context: any): Promise<any>;
}
