declare const promptFactory: any;
declare const LlmService: any;
declare const llmService: any;
declare const log: any;
declare class TaskAnalysisService {
    static lastAnalysis: any;
    static analyzeTaskScope(task: any, project: any, preAnalysisFile?: any): Promise<any>;
    static getFallbackScope(task: any): {
        taskType: string;
        requiresReport: any;
        expectedLayers: any[];
        requiredModifiedLayers: any[];
        mandatoryChecks: string[];
        definitionOfDone: string[];
        finalizationInstructions: string[];
        risks: string[];
    };
    /**
     * AGORA COMPATÍVEL: Retorna o valor decidido pela IA,
     * ou usa o Regex como fallback se a IA ainda não tiver sido chamada.
     */
    static requiresReport(task: any): any;
    /**
     * Analisa a resposta do arquiteto para determinar se:
     * 1. Já executou a tarefa
     * 2. Gerou um plano para execução
     * 3. Não conseguiu analisar
     * @param {string} architectResponse - Resposta do arquiteto
     * @param {Object} task - Tarefa original
     * @param {Object} project - Projeto
     * @returns {Promise<Object>} Análise estruturada
     */
    static analyzeArchitectResponse(architectResponse: any, task: any, project: any): Promise<any>;
    /**
     * Fallback para análise de resposta do arquiteto (quando LLM falha)
     * @param {string} architectResponse - Resposta do arquiteto
     * @returns {Object} Análise fallback
     */
    static getFallbackArchitectAnalysis(architectResponse: any): {
        hasExecuted: boolean;
        hasPlan: boolean;
        confidence: number;
        executionDetails: string;
        planDetails: string;
        analysisFailed: any;
    };
}
