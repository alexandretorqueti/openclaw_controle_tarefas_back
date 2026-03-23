/**
 * Serviço de cache para agentes
 * Cache com validade de 1 hora e atualização em tempo real para operações CRUD
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
class AgentCache {
    constructor() {
        this.cache = null;
        this.cacheTimestamp = null;
        this.cacheTTL = 60 * 60 * 1000; // 1 hora em milissegundos
        this.isRefreshing = false;
        this.refreshQueue = [];
    }
    /**
     * Verifica se o cache é válido
     * @returns {boolean} True se o cache existe e não expirou
     */
    isValid() {
        if (!this.cache || !this.cacheTimestamp) {
            return false;
        }
        const now = Date.now();
        return (now - this.cacheTimestamp) < this.cacheTTL;
    }
    /**
     * Obtém agentes do cache ou atualiza se necessário
     * @param {Function} fetchFunction - Função para buscar agentes se o cache estiver inválido
     * @returns {Promise<Array>} Lista de agentes
     */
    getAgents(fetchFunction) {
        return __awaiter(this, void 0, void 0, function* () {
            // Se o cache é válido, retorna do cache
            if (this.isValid()) {
                return [...this.cache]; // Retorna cópia para evitar mutação
            }
            // Se já está atualizando, aguarda na fila
            if (this.isRefreshing) {
                return new Promise((resolve) => {
                    this.refreshQueue.push(resolve);
                });
            }
            // Atualiza o cache
            this.isRefreshing = true;
            try {
                const agents = yield fetchFunction();
                this.cache = agents;
                this.cacheTimestamp = Date.now();
                this.isRefreshing = false;
                // Resolve todas as promises na fila
                while (this.refreshQueue.length > 0) {
                    const resolve = this.refreshQueue.shift();
                    resolve([...agents]); // Passa cópia para cada
                }
                return [...agents]; // Retorna cópia
            }
            catch (error) {
                this.isRefreshing = false;
                // Limpa a fila com erro
                while (this.refreshQueue.length > 0) {
                    const resolve = this.refreshQueue.shift();
                    resolve([]); // Retorna array vazio em caso de erro
                }
                throw error;
            }
        });
    }
    /**
     * Atualiza o cache com novos dados
     * @param {Array} agents - Nova lista de agentes
     */
    updateCache(agents) {
        this.cache = agents;
        this.cacheTimestamp = Date.now();
    }
    /**
     * Invalida o cache
     */
    invalidate() {
        this.cache = null;
        this.cacheTimestamp = null;
    }
    /**
     * Limpa completamente o cache (para testes)
     */
    clear() {
        this.cache = null;
        this.cacheTimestamp = null;
        this.refreshQueue = [];
    }
    /**
     * Obtém estatísticas do cache
     * @returns {Object} Estatísticas do cache
     */
    getStats() {
        return {
            hasCache: !!this.cache,
            cacheSize: this.cache ? this.cache.length : 0,
            cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
            cacheTTL: this.cacheTTL,
            isRefreshing: this.isRefreshing,
            queueSize: this.refreshQueue.length
        };
    }
}
module.exports = new AgentCache();
