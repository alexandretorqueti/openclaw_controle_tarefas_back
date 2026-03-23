/**
 * Formata uma lista como itens numerados
 * @param {string[]} items - Lista de itens
 * @param {string} emptyFallback - Texto para lista vazia
 * @returns {string}
 */
declare function formatNumberedList(items: any, emptyFallback?: string): any;
/**
 * Formata uma lista inline (separada por virgulas)
 * @param {string[]} items - Lista de itens
 * @param {string} emptyFallback - Texto para lista vazia
 * @returns {string}
 */
declare function formatInlineList(items: any, emptyFallback?: string): any;
/**
 * Imprime bloco de debug no console
 * @param {string} title - Titulo do bloco
 * @param {*} data - Dados a imprimir
 */
declare function printDebugBlock(title: any, data: any): void;
/**
 * Formata bytes para tamanho legivel
 * @param {number} bytes - Tamanho em bytes
 * @returns {string}
 */
declare function formatBytes(bytes: any): string;
