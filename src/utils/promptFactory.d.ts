declare class PromptFactory {
    /**
     * Gera o prompt para a análise inicial de escopo da tarefa.
     */
    static buildTaskAnalysisPrompt(task: any, project: any, preAnalysisFile?: any): string;
    static buildArchitectPrompt(task: any, project: any, fileList: any, planFilePath: any, commentsSection?: string, taskType?: string): string;
    static buildAgentSystemPrompt(agentContext: any): string;
    /**
     * Exemplo: Prompt para gerar relatórios
     */
    static buildReportPrompt(taskTitle: any, executionEvidence: any): string;
    static buildEngineRulesPrompt(files: any): string;
    static buildArchitectAnalysisPrompt(architectResponse: any, task: any, project: any): string;
    /**
     * Gera o prompt para o Arquiteto decompor uma Tarefa Mãe em micro-tarefas de Front e Back.
     */
    static buildDecompositionPrompt(task: any): string;
    /**
     * Constrói prompt para validação de atomicidade
     * @param {Object} task - Tarefa
     * @param {Object} project - Projeto
     * @returns {string} Prompt formatado
     */
    static buildValidationPrompt(task: any, project: any): string;
    static ensureAndValidateBuildPrompt(pkgContent: any): string;
}
