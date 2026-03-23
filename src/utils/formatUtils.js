// src/utils/formatUtils.js
// Utilitarios para formatacao de dados
/**
 * Formata uma lista como itens numerados
 * @param {string[]} items - Lista de itens
 * @param {string} emptyFallback - Texto para lista vazia
 * @returns {string}
 */
function formatNumberedList(items, emptyFallback = 'Nenhum item definido.') {
    if (!items || items.length === 0) {
        return `1. ${emptyFallback}`;
    }
    return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}
/**
 * Formata uma lista inline (separada por virgulas)
 * @param {string[]} items - Lista de itens
 * @param {string} emptyFallback - Texto para lista vazia
 * @returns {string}
 */
function formatInlineList(items, emptyFallback = 'nenhum') {
    if (!items || items.length === 0)
        return emptyFallback;
    return items.join(', ');
}
/**
 * Imprime bloco de debug no console
 * @param {string} title - Titulo do bloco
 * @param {*} data - Dados a imprimir
 */
function printDebugBlock(title, data) {
    console.log(`\n================ [DEBUG][${title}] ================`);
    if (typeof data === 'string') {
        console.log(data);
    }
    else {
        console.log(JSON.stringify(data, null, 2));
    }
    console.log(`================ [FIM DEBUG][${title}] ================\n`);
}
/**
 * Formata bytes para tamanho legivel
 * @param {number} bytes - Tamanho em bytes
 * @returns {string}
 */
function formatBytes(bytes) {
    if (bytes === 0)
        return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
module.exports = {
    formatNumberedList,
    formatInlineList,
    printDebugBlock,
    formatBytes
};
