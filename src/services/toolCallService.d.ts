declare const extractJsonObjects: any, inspectJsonLikeStructure: any;
declare class ToolCallService {
    static SUPPORTED_TOOLS: string[];
    /**
     * Normaliza um tool call para formato padrao
     * @param {Object} parsed - Objeto parseado
     * @returns {Object|null}
     */
    static normalizeToolCall(parsed: any): {
        name: any;
        arguments: {
            command: any;
            file_path?: undefined;
            content?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            command?: undefined;
            content?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            content: any;
            command?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            oldText: string;
            newText: string;
            command?: undefined;
            content?: undefined;
        };
    };
    /**
     * Extrai tool call de um texto
     * @param {string} text - Texto contendo tool call
     * @returns {Object|null}
     */
    static extractToolCallFromText(text: any): {
        name: any;
        arguments: {
            command: any;
            file_path?: undefined;
            content?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            command?: undefined;
            content?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            content: any;
            command?: undefined;
            oldText?: undefined;
            newText?: undefined;
        };
    } | {
        name: any;
        arguments: {
            file_path: string;
            oldText: string;
            newText: string;
            command?: undefined;
            content?: undefined;
        };
    };
    /**
     * Tenta identificar o nome da ferramenta no texto
     * @param {string} text - Texto a analisar
     * @returns {string|null}
     */
    static getLikelyToolNameFromText(text: any): string;
    /**
     * Detecta tool call truncada
     * @param {string} text - Texto a analisar
     * @returns {Object|null}
     */
    static detectTruncatedToolCall(text: any): {
        detected: boolean;
        likelyTool: string;
        reason: string;
        preview: string;
    };
    /**
     * Constroi assinatura de turno para deteccao de loop
     * @param {Object} executionResult - Resultado da execucao
     * @returns {string}
     */
    static buildTurnSignature(executionResult: any): any;
    /**
     * Normaliza assinatura de acao para comparacao
     * @param {string} toolName - Nome da ferramenta
     * @param {Object} toolResult - Resultado da ferramenta
     * @param {string} fallbackCommand - Comando fallback
     * @returns {string}
     */
    static normalizeActionSignature(toolName: any, toolResult?: {}, fallbackCommand?: string): any;
    /**
     * Detecta loop de acoes repetidas
     * @param {string[]} signatures - Array de assinaturas
     * @param {number} maxPatternSize - Tamanho maximo do padrao
     * @param {number} repetitions - Numero de repeticoes
     * @returns {Object}
     */
    static detectRepeatedActionLoop(signatures: any, maxPatternSize?: number, repetitions?: number): {
        detected: boolean;
        patternSize?: undefined;
        repetitions?: undefined;
        pattern?: undefined;
    } | {
        detected: boolean;
        patternSize: number;
        repetitions: number;
        pattern: any[];
    };
}
