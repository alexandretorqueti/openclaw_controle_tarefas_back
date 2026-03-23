declare const path: any;
declare const normalizeFsPath: any, extractPathTokensFromCommand: any, uniquePaths: any;
/**
 * Normaliza assinatura de comando para comparacao
 * @param {string} command - Comando a normalizar
 * @returns {string}
 */
declare function normalizeCommandSignature(command: any): string;
/**
 * Verifica se e um comando de inspecao (read-only)
 * @param {string} command - Comando a verificar
 * @returns {boolean}
 */
declare function isInspectionCommand(command: any): boolean;
/**
 * Verifica se e um comando de mutacao (altera arquivos)
 * @param {string} command - Comando a verificar
 * @returns {boolean}
 */
declare function isMutationCommand(command: any): boolean;
/**
 * Verifica se comando afeta apenas arquivos especiais (artefatos)
 * @param {string} command - Comando a verificar
 * @param {string[]} specialFiles - Lista de arquivos especiais
 * @param {string} cwd - Diretorio de trabalho
 * @returns {boolean}
 */
declare function commandTargetsOnlySpecialFiles(command: any, specialFiles?: any[], cwd?: string): any;
/**
 * Verifica se e um comando significativo (nao trivial)
 * @param {string} command - Comando a verificar
 * @param {string[]} specialFiles - Arquivos especiais a ignorar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {boolean}
 */
declare function isMeaningfulCommand(command: any, specialFiles?: any[], cwd?: string): boolean;
/**
 * Infere evidencia de leitura de um comando
 * @param {string} command - Comando a analisar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {Object}
 */
declare function inferReadOnlyEvidenceFromCommand(command?: string, cwd?: string): {
    filesRead: any[];
    filesWritten: any[];
    modifiedFiles: any[];
    touchedFiles: any[];
};
