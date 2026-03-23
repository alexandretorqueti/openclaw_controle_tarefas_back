/**
 * Step que orquestra o loop completo do desenvolvedor.
 * Gerencia múltiplos turnos, verificação de contrato, validação de ecossistema e monitoramento de progresso.
 */
declare const container: any;
declare class DeveloperLoopOrchestrator {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa o loop completo do desenvolvedor
     * @param {Object} context - Contexto do pipeline (deve conter dados dos steps anteriores)
     * @returns {Promise<Object>} Contexto atualizado com resultado do loop
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado do loop
     */
    static executeLoop(context: any): Promise<any>;
}
