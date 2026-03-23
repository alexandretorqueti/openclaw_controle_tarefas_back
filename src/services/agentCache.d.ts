/**
 * Serviço de cache para agentes
 * Cache com validade de 1 hora e atualização em tempo real para operações CRUD
 */
declare class AgentCache {
    constructor();
    /**
     * Verifica se o cache é válido
     * @returns {boolean} True se o cache existe e não expirou
     */
    isValid(): boolean;
    /**
     * Obtém agentes do cache ou atualiza se necessário
     * @param {Function} fetchFunction - Função para buscar agentes se o cache estiver inválido
     * @returns {Promise<Array>} Lista de agentes
     */
    getAgents(fetchFunction: any): Promise<unknown>;
    /**
     * Atualiza o cache com novos dados
     * @param {Array} agents - Nova lista de agentes
     */
    updateCache(agents: any): void;
    /**
     * Invalida o cache
     */
    invalidate(): void;
    /**
     * Limpa completamente o cache (para testes)
     */
    clear(): void;
    /**
     * Obtém estatísticas do cache
     * @returns {Object} Estatísticas do cache
     */
    getStats(): {
        hasCache: boolean;
        cacheSize: any;
        cacheAge: number;
        cacheTTL: any;
        isRefreshing: any;
        queueSize: any;
    };
}
