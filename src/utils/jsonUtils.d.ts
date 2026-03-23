/**
 * Extrai objetos ou arrays JSON de uma string de texto.
 * Melhora a lógica original para suportar arrays e parsing automático.
 */
declare function extractJsonObjects(text: any): any[];
/**
 * Inspeciona estrutura de JSON para detectar truncamento
 * @param {string} text - Texto a inspecionar
 * @returns {Object}
 */
declare function inspectJsonLikeStructure(text: any): {
    finalDepth: number;
    inString: boolean;
    sawOpeningBrace: boolean;
};
/**
 * Faz parse seguro de JSON
 * @param {string} jsonString - String JSON
 * @param {*} defaultValue - Valor padrao se falhar
 * @returns {*}
 */
declare function safeParse(jsonString: any, defaultValue?: any): any;
/**
 * Stringify seguro de JSON
 * @param {*} value - Valor a serializar
 * @param {number} indent - Indentacao (default: 2)
 * @returns {string}
 */
declare function safeStringify(value: any, indent?: number): string;
