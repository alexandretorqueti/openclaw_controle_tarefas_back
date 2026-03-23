/**
 * Step responsável por obter a próxima tarefa elegível para execução.
 * Faz requisição à API e trata casos de fila vazia ou erros.
 */
declare const container: any;
declare class GetNextTaskStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options?: {});
    /**
     * Executa o step para obter próxima tarefa
     * @param {Object} context - Contexto do pipeline
     * @param {string} context.nickname - Nickname do usuário
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com tarefa encontrada
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {string} nickname - Nickname do usuário
     * @param {string} apiUrl - URL da API (opcional)
     * @returns {Promise<Object|null>} Tarefa encontrada ou null
     */
    static getNextTask(nickname: any, apiUrl?: any): Promise<any>;
}
