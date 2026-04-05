// agentCache.ts

export interface CacheStats {
    hasCache: boolean;
    cacheSize: number;
    cacheAge: number | null;
    cacheTTL: number;
    isRefreshing: boolean;
    queueSize: number;
}

// O uso do <T> permite que você defina o tipo exato do agente (ex: AgentConfig)
export class AgentCache<T = any> {
    // 1. Tipagem rigorosa das propriedades (private protege contra alterações externas)
    private cache: T[] | null = null;
    private cacheTimestamp: number | null = null;
    private readonly cacheTTL: number = 60 * 60 * 1000; // 1 hora
    private isRefreshing: boolean = false;
    
    // Fila de resoluções fortemente tipada
    private refreshQueue: Array<(value: T[]) => void> = [];

    /**
     * Verifica se o cache é válido
     */
    public isValid(): boolean {
        if (!this.cache || !this.cacheTimestamp) {
            return false;
        }
        const now = Date.now();
        return (now - this.cacheTimestamp) < this.cacheTTL;
    }

    /**
     * Obtém agentes do cache ou atualiza se necessário
     * @param fetchFunction Função injetada que retorna uma Promise tipada
     */
    public async getAgents(fetchFunction: () => Promise<T[]>): Promise<T[]> {
        if (this.isValid()) {
            return [...this.cache!]; // O '!' garante ao TS que this.cache não é null aqui
        }

        if (this.isRefreshing) {
            return new Promise((resolve) => {
                this.refreshQueue.push(resolve);
            });
        }

        this.isRefreshing = true;
        try {
            const agents = await fetchFunction();
            this.cache = agents;
            this.cacheTimestamp = Date.now();
            this.isRefreshing = false;

            while (this.refreshQueue.length > 0) {
                const resolve = this.refreshQueue.shift();
                if (resolve) resolve([...agents]);
            }

            return [...agents];
        } catch (error) {
            this.isRefreshing = false;
            while (this.refreshQueue.length > 0) {
                const resolve = this.refreshQueue.shift();
                if (resolve) resolve([]);
            }
            throw error;
        }
    }

    /**
     * Atualiza o cache com novos dados
     */
    public updateCache(agents: T[]): void {
        this.cache = agents;
        this.cacheTimestamp = Date.now();
    }

    public invalidate(): void {
        this.cache = null;
        this.cacheTimestamp = null;
    }

    public clear(): void {
        this.cache = null;
        this.cacheTimestamp = null;
        this.refreshQueue = [];
    }

    /**
     * Obtém estatísticas do cache
     */
    public getStats(): CacheStats {
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

// ============================================================================
// O SEGREDO DA IMPORTAÇÃO RESOLVIDO AQUI 👇
// ============================================================================
// Exportamos uma instância Singleton pronta para uso em toda a aplicação.
// Se você tiver uma interface 'AgentConfig', pode fazer: new AgentCache<AgentConfig>();
export const agentCache = new AgentCache();