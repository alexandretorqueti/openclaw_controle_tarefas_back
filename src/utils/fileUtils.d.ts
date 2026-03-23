declare const fs: any;
declare const fsSync: any;
declare const path: any;
declare const crypto: any;
/**
 * Verifica se um arquivo existe de forma assincrona
 * @param {string} pathToCheck - Caminho do arquivo
 * @returns {Promise<boolean>}
 */
declare function fileExists(pathToCheck: any): Promise<boolean>;
/**
 * Verifica se um arquivo existe de forma sincrona
 * @param {string} pathToCheck - Caminho do arquivo
 * @returns {boolean}
 */
declare function fileExistsSync(pathToCheck: any): any;
/**
 * Le conteudo de um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @param {string} encoding - Encoding (default: utf8)
 * @returns {Promise<string|null>}
 */
declare function safeReadFile(filePath: any, encoding?: string): Promise<any>;
/**
 * Escreve conteudo em um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @param {string} content - Conteudo a escrever
 * @param {string} encoding - Encoding (default: utf8)
 * @returns {Promise<boolean>}
 */
declare function safeWriteFile(filePath: any, content: any, encoding?: string): Promise<boolean>;
/**
 * Remove um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<boolean>}
 */
declare function safeUnlink(filePath: any): Promise<boolean>;
/**
 * Move um arquivo de forma segura
 * @param {string} sourcePath - Caminho de origem
 * @param {string} destPath - Caminho de destino
 * @returns {Promise<boolean>}
 */
declare function safeMoveFile(sourcePath: any, destPath: any): Promise<boolean>;
/**
 * Trunca output longo
 * @param {string} text - Texto a truncar
 * @param {number} max - Tamanho maximo (default: 20000)
 * @returns {string}
 */
declare function truncateOutput(text: any, max?: number): string;
/**
 * Verifica se um arquivo é um artefato efêmero (temporário, log, sistema)
 * que não deve ser considerado como evidência significativa da execução da tarefa.
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean}
 */
declare function isEphemeralArtifact(filePath: any): boolean;
