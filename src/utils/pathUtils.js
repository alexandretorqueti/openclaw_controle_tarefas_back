// src/utils/pathUtils.js
// Utilitarios para manipulacao de caminhos
const path = require('path');
/**
 * Normaliza um array de caminhos, removendo duplicatas e resolvendo
 * @param {string[]} values - Array de caminhos
 * @returns {string[]}
 */
function uniquePaths(values = []) {
    return Array.from(new Set((values || [])
        .filter(Boolean)
        .map((value) => path.resolve(String(value)))));
}
/**
 * Merge dois arrays de caminhos, mantendo apenas valores unicos
 * @param {string[]} current - Array atual
 * @param {string[]} incoming - Array a ser adicionado
 * @returns {string[]}
 */
function mergeUniquePaths(current = [], incoming = []) {
    return uniquePaths([...(current || []), ...(incoming || [])]);
}
/**
 * Resolve um caminho de projeto baseado em basePath e subPath
 * @param {string} basePath - Caminho base
 * @param {string} subPath - Subcaminho
 * @returns {string|null}
 */
function resolveProjectPath(basePath, subPath) {
    if (!subPath)
        return null;
    if (path.isAbsolute(subPath))
        return path.resolve(subPath);
    if (!basePath)
        return path.resolve(subPath);
    return path.resolve(basePath, subPath);
}
/**
 * Verifica se um caminho esta dentro de outro
 * @param {string} targetPath - Caminho alvo
 * @param {string} basePath - Caminho base
 * @returns {boolean}
 */
function isPathInside(targetPath, basePath) {
    if (!targetPath || !basePath)
        return false;
    const normalizedTarget = path.resolve(targetPath);
    const normalizedBase = path.resolve(basePath);
    return (normalizedTarget === normalizedBase ||
        normalizedTarget.startsWith(normalizedBase + path.sep));
}
/**
 * Resolve um caminho de arquivo, tratando caminhos absolutos e relativos
 * @param {string} filePath - Caminho do arquivo
 * @param {string} cwd - Diretorio de trabalho
 * @returns {string}
 */
function resolveFilePath(filePath, cwd) {
    if (!filePath || typeof filePath !== 'string') {
        throw new Error('Caminho de arquivo invalido.');
    }
    return path.isAbsolute(filePath)
        ? path.resolve(filePath)
        : path.resolve(cwd, filePath);
}
/**
 * Normaliza um caminho de sistema de arquivos
 * @param {string} filePath - Caminho do arquivo
 * @param {string} baseDir - Diretorio base (default: process.cwd())
 * @returns {string|null}
 */
function normalizeFsPath(filePath, baseDir = process.cwd()) {
    if (!filePath || typeof filePath !== 'string')
        return null;
    let normalized = filePath.trim().replace(/^['"`]/, '').replace(/['"`]$/, '');
    if (!normalized)
        return null;
    if (normalized.startsWith('~')) {
        const home = process.env.HOME || '';
        normalized = path.join(home, normalized.slice(1));
    }
    if (path.isAbsolute(normalized)) {
        return path.resolve(normalized);
    }
    return path.resolve(baseDir || process.cwd(), normalized);
}
/**
 * Extrai tokens de caminho de um comando
 * @param {string} command - Comando a analisar
 * @returns {string[]}
 */
function extractPathTokensFromCommand(command) {
    if (!command || typeof command !== 'string')
        return [];
    const tokens = [];
    const regex = /(["'`])([^"'`\n]*\/[^"'`\n]*)\1|((?:\/|\.{1,2}\/|[A-Za-z0-9_.-]+\/)[^\s|;&]+)/g;
    let match;
    while ((match = regex.exec(command)) !== null) {
        const raw = (match[2] || match[3] || '').trim();
        if (!raw)
            continue;
        const cleaned = raw.replace(/[),:]+$/g, '');
        if (cleaned)
            tokens.push(cleaned);
    }
    return Array.from(new Set(tokens));
}
module.exports = {
    uniquePaths,
    mergeUniquePaths,
    resolveProjectPath,
    isPathInside,
    resolveFilePath,
    normalizeFsPath,
    extractPathTokensFromCommand
};
