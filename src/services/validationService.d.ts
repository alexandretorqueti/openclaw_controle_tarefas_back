declare const LlmService: any;
declare const buildValidationPrompt: any;
/**
 * Serviço de validação de atomicidade de tarefas
 * Utiliza LLM (Ollama) para determinar se uma tarefa é atômica
 */
declare class ValidationService {
    constructor();
    /**
     * Cria logger compatível (usa console se logger não estiver disponível)
     */
    createLogger(): {
        logInfo: (message: any) => any;
        logError: (message: any, error: any) => any;
        logWarning: (message: any) => any;
        logDebug: (message: any) => void;
    };
    /**
     * Valida se uma tarefa é atômica usando modelo auxiliar
     * @param {Object} task - Objeto da tarefa
     * @param {Object} project - Objeto do projeto
     * @returns {Promise<Object>} Resultado da validação {isAtomic, reason, confidence}
     */
    validateWithAuxModel(task: any, project: any): Promise<any>;
    /**
     * Processa a resposta do LLM
     * @param {Object} llmResponse - Resposta do LLM (objeto JSON)
     * @param {Object} task - Tarefa original
     * @returns {Object} Resultado validado
     */
    parseLlmResponse(llmResponse: any, task: any): {
        isAtomic: any;
        domain: any;
        reason: any;
        confidence: any;
        suggestions: any;
        source: string;
        taskId: any;
        timestamp: string;
    };
    /**
     * Validação de fallback quando LLM falha
     * @param {Object} task - Tarefa
     * @param {string} error - Mensagem de erro
     * @returns {Object} Resultado de fallback
     */
    getFallbackValidation(task: any, error?: string): {
        isAtomic: boolean;
        reason: string;
        confidence: number;
        suggestions: string[];
        source: string;
        taskId: any;
        timestamp: string;
        error: string;
    };
    /**
     * Executa função com timeout
     * @param {Function} fn - Função a executar
     * @param {number} timeoutMs - Timeout em milissegundos
     * @param {string} timeoutMessage - Mensagem de timeout
     * @returns {Promise<any>} Resultado da função
     */
    callWithTimeout(fn: any, timeoutMs: any, timeoutMessage: any): Promise<any>;
    /**
     * Limpa o cache de validações
     * @param {number} maxAgeMs - Idade máxima em milissegundos (opcional)
     */
    clearCache(maxAgeMs: any): void;
    /**
     * Valida múltiplas tarefas em lote
     * @param {Array} tasks - Array de tarefas
     * @param {Object} project - Projeto
     * @returns {Promise<Array>} Resultados das validações
     */
    validateBatch(tasks: any, project: any): Promise<any[]>;
}
