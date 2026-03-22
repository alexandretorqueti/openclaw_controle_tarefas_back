/**
 * Serviço de cache para agentes
 * Cache com validade de 1 hora e atualização em tempo real para operações CRUD
 */

class AgentCache {
  private cache: any = null;
  private cacheTimestamp: number | null = null;
  private readonly cacheTTL: number = 60 * 60 * 1000; // 1 hora em milissegundos
  private isRefreshing: boolean = false;
  private refreshQueue: Array<(data: any) => void> = [];

  constructor() {
    // Inicialização do constructor TypeScript
  }

  /**
   * Verifica se o cache é válido
   * @returns {boolean} True se o cache existe e não expirou
   */
  isValid(): boolean {
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
  async getAgents(fetchFunction: (() => Promise<any>)): Promise<any> {
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
      const agents = await fetchFunction();
      this.cache = agents;
      this.cacheTimestamp = Date.now();
      this.isRefreshing = false;
      
      // Resolve todas as promises na fila
      while (this.refreshQueue.length > 0) {
        const resolve = this.refreshQueue.shift();
        resolve([...agents]); // Passa cópia para cada
      }
      
      return [...agents]; // Retorna cópia
    } catch (error) {
      this.isRefreshing = false;
      // Limpa a fila com erro
      while (this.refreshQueue.length > 0) {
        const resolve = this.refreshQueue.shift();
        resolve([]); // Retorna array vazio em caso de erro
      }
      throw error;
    }
  }

  /**
   * Atualiza o cache com novos dados
   * @param {Array} agents - Nova lista de agentes
   */
  updateCache(agents: any): void {
    this.cache = agents;
    this.cacheTimestamp = Date.now();
  }

  /**
   * Invalida o cache
   */
  invalidate(): void {
    this.cache = null;
    this.cacheTimestamp = null;
  }

  /**
   * Limpa completamente o cache (para testes)
   */
  clear(): void {
    this.cache = null;
    this.cacheTimestamp = null;
    this.refreshQueue = [];
  }

  /**
   * Obtém estatísticas do cache
   * @returns {Object} Estatísticas do cache
   */
  getStats(): {
    hasCache: boolean;
    cacheSize: number;
    cacheAge: number | null;
    cacheTTL: number;
    isRefreshing: boolean;
    queueSize: number
  } {
    return {
      hasCache: !!this.cache,
      cacheSize: this.cache ? this.cache.length : 0,
      cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
      cacheTTL: this.cacheTTL,
      isRefreshing: this.isRefreshing,
      queueSize: this.refreshQueue.length
    };
  }

  getCacheInfo() {
        return {
            hasCache: !!this.cache,
            cacheSize: this.cache ? this.cache.length : 0,
            cacheAge: this.cacheTimestamp ? Date.now() - this.cacheTimestamp : null,
            cacheTTL: this.cacheTTL
        };
    }
}

export default new AgentCache();
export { AgentCache };
