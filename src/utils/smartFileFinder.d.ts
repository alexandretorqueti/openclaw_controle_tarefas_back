declare const fs: any;
declare const path: any;
declare class SmartFileFinder {
    static sleep(ms: any): Promise<unknown>;
    /**
     * Procura o verdadeiro arquivo de plano do arquiteto, driblando nomes inventados
     * e arquivos falsos, aguardando a gravação física no disco.
     */
    static findRealArchitectPlan(expectedPath: any, taskDir: any, maxRetries?: number): Promise<{
        content: any;
        path: any;
    }>;
}
