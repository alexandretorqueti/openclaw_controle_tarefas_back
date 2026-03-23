declare const path: any;
/**
 * Merge dois arrays de caminhos, mantendo apenas valores unicos
 * @param {string[]} current - Array atual
 * @param {string[]} incoming - Array a ser adicionado
 * @returns {string[]}
 */
declare function mergeUniquePaths(current?: any[], incoming?: any[]): any[];
/**
 * Resolve um caminho de projeto baseado em basePath e subPath
 * @param {string} basePath - Caminho base
 * @param {string} subPath - Subcaminho
 * @returns {string|null}
 */
declare function resolveProjectPath(basePath: any, subPath: any): any;
/**
 * Verifica se um caminho esta dentro de outro
 * @param {string} targetPath - Caminho alvo
 * @param {string} basePath - Caminho base
 * @returns {boolean}
 */
declare function isPathInside(targetPath: any, basePath: any): any;
/**
 * Resolve um caminho de arquivo, tratando caminhos absolutos e relativos
 * @param {string} filePath - Caminho do arquivo
 * @param {string} cwd - Diretorio de trabalho
 * @returns {string}
 */
declare function resolveFilePath(filePath: any, cwd: any): any;
/**
 * Normaliza um caminho de sistema de arquivos
 * @param {string} filePath - Caminho do arquivo
 * @param {string} baseDir - Diretorio base (default: process.cwd())
 * @returns {string|null}
 */
declare function normalizeFsPath(filePath: any, baseDir?: string): any;
/**
 * Extrai tokens de caminho de um comando
 * @param {string} command - Comando a analisar
 * @returns {string[]}
 */
declare function extractPathTokensFromCommand(command: any): any[];
