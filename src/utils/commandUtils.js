// src/utils/commandUtils.js
// Utilitarios para analise e manipulacao de comandos shell
const path = require('path');
const { normalizeFsPath, extractPathTokensFromCommand, uniquePaths } = require('./pathUtils');
/**
 * Separa um comando shell em tokens (respeitando quotes)
 * @param {string} input - Comando a separar
 * @returns {string[]}
 */
function shellSplit(input = '') {
    const tokens = [];
    let current = '';
    let quote = null;
    let escaped = false;
    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];
        if (escaped) {
            current += ch;
            escaped = false;
            continue;
        }
        if (ch === '\\' && quote !== "'") {
            escaped = true;
            continue;
        }
        if (quote) {
            if (ch === quote) {
                quote = null;
            }
            else {
                current += ch;
            }
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            continue;
        }
        if (/\s/.test(ch)) {
            if (current) {
                tokens.push(current);
                current = '';
            }
            continue;
        }
        current += ch;
    }
    if (current) {
        tokens.push(current);
    }
    return tokens;
}
/**
 * Normaliza assinatura de comando para comparacao
 * @param {string} command - Comando a normalizar
 * @returns {string}
 */
function normalizeCommandSignature(command) {
    if (!command || typeof command !== 'string')
        return '';
    return command
        .trim()
        .replace(/\s+/g, ' ')
        .replace(/["']/g, '')
        .toLowerCase();
}
/**
 * Verifica se e um comando de inspecao (read-only)
 * @param {string} command - Comando a verificar
 * @returns {boolean}
 */
function isInspectionCommand(command) {
    if (!command || typeof command !== 'string')
        return false;
    return /(^|\s)(find|grep|sed\s+-n|cat|ls|pwd|head|tail|awk|rg)\b/i.test(command);
}
/**
 * Verifica se e um comando de mutacao (altera arquivos)
 * @param {string} command - Comando a verificar
 * @returns {boolean}
 */
function isMutationCommand(command) {
    if (!command || typeof command !== 'string')
        return false;
    return (/\bsed\s+-i\b/i.test(command) ||
        /\bperl\s+-pi\b/i.test(command) ||
        /^\s*touch\b/i.test(command) ||
        /^\s*rm\b/i.test(command) ||
        /^\s*mv\b/i.test(command) ||
        /^\s*cp\b/i.test(command) ||
        /\btee\b/i.test(command) ||
        /(^|[^0-9])>>?\s*["'`]?[^"'`\s|;&]+["'`]?/i.test(command));
}
/**
 * Verifica se comando afeta apenas arquivos especiais (artefatos)
 * @param {string} command - Comando a verificar
 * @param {string[]} specialFiles - Lista de arquivos especiais
 * @param {string} cwd - Diretorio de trabalho
 * @returns {boolean}
 */
function commandTargetsOnlySpecialFiles(command, specialFiles = [], cwd = process.cwd()) {
    if (!command || typeof command !== 'string')
        return false;
    const resolvedSpecialFiles = new Set((specialFiles || [])
        .filter(Boolean)
        .map((file) => path.resolve(file)));
    const commandPaths = extractPathTokensFromCommand(command)
        .map((token) => normalizeFsPath(token, cwd))
        .filter(Boolean);
    if (commandPaths.length === 0)
        return false;
    return commandPaths.every((file) => resolvedSpecialFiles.has(path.resolve(file)));
}
/**
 * Verifica se e um comando significativo (nao trivial)
 * @param {string} command - Comando a verificar
 * @param {string[]} specialFiles - Arquivos especiais a ignorar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {boolean}
 */
function isMeaningfulCommand(command, specialFiles = [], cwd = process.cwd()) {
    if (!command || typeof command !== 'string')
        return false;
    const normalized = normalizeCommandSignature(command);
    if (!normalized)
        return false;
    if (normalized === 'pwd')
        return false;
    if (/^ls( -[a-z0-9]+)*$/.test(normalized))
        return false;
    if (commandTargetsOnlySpecialFiles(command, specialFiles, cwd)) {
        return false;
    }
    if (/^touch\s+.+\.done\b/.test(normalized))
        return false;
    if (/^rm\s+.+\.done\b/.test(normalized))
        return false;
    if (/^ls( -[a-z0-9]+)*\s+.+\.done\b/.test(normalized))
        return false;
    return true;
}
/**
 * Verifica se um comando parece ser de mutacao
 * @param {string} command - Comando a verificar
 * @returns {boolean}
 */
function looksLikeMutationCommand(command = '') {
    const compact = String(command || '').trim();
    return (/\bsed\s+-i(\S*)?\b/.test(compact) ||
        /\bperl\s+-[^\n]*i/.test(compact) ||
        /^\s*touch\b/.test(compact) ||
        /^\s*rm\b/.test(compact) ||
        /^\s*cp\b/.test(compact) ||
        /^\s*mv\b/.test(compact) ||
        /\btee\b/.test(compact) ||
        /(^|[^0-9])>>?\s*["'`]?[^"'`\s|;&]+["'`]?/.test(compact));
}
/**
 * Extrai arquivos candidatos a mutacao de um comando
 * @param {string} command - Comando a analisar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {string[]}
 */
function extractMutationCandidateFiles(command = '', cwd = process.cwd()) {
    const tokens = shellSplit(command);
    if (!tokens.length)
        return [];
    const executable = path.basename(tokens[0]);
    const candidates = [];
    if (executable === 'sed' && tokens.some((t) => t === '-i' || /^-i/.test(t))) {
        let i = 1;
        while (i < tokens.length && tokens[i].startsWith('-')) {
            i += 1;
        }
        if (i < tokens.length) {
            i += 1; // pula o script do sed
        }
        candidates.push(...tokens
            .slice(i)
            .filter((t) => t && !t.startsWith('-'))
            .map((t) => path.resolve(cwd, t)));
    }
    if (executable === 'perl' && tokens.some((t) => /^-.*i/.test(t))) {
        let i = 1;
        while (i < tokens.length && tokens[i].startsWith('-')) {
            i += 1;
        }
        if (i < tokens.length) {
            i += 1;
        }
        candidates.push(...tokens
            .slice(i)
            .filter((t) => t && !t.startsWith('-'))
            .map((t) => path.resolve(cwd, t)));
    }
    if (executable === 'touch' || executable === 'rm') {
        candidates.push(...tokens
            .slice(1)
            .filter((t) => t && !t.startsWith('-'))
            .map((t) => path.resolve(cwd, t)));
    }
    if (executable === 'cp' || executable === 'mv') {
        const nonOptionArgs = tokens.slice(1).filter((t) => t && !t.startsWith('-'));
        if (nonOptionArgs.length > 0) {
            candidates.push(path.resolve(cwd, nonOptionArgs[nonOptionArgs.length - 1]));
        }
    }
    if (executable === 'tee') {
        candidates.push(...tokens
            .slice(1)
            .filter((t) => t && !t.startsWith('-'))
            .map((t) => path.resolve(cwd, t)));
    }
    candidates.push(...extractRedirectionTargets(command, cwd));
    return uniquePaths(candidates);
}
/**
 * Extrai alvos de redirecionamento de um comando
 * @param {string} command - Comando a analisar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {string[]}
 */
function extractRedirectionTargets(command = '', cwd = process.cwd()) {
    const targets = [];
    const regex = /(^|[^0-9])>>?\s*(["'`])?([^"'`\s|;&]+)\2?/g;
    let match;
    while ((match = regex.exec(command)) !== null) {
        const rawTarget = (match[3] || '').trim();
        if (!rawTarget)
            continue;
        targets.push(path.resolve(cwd, rawTarget));
    }
    return uniquePaths(targets);
}
/**
 * Infere evidencia de leitura de um comando
 * @param {string} command - Comando a analisar
 * @param {string} cwd - Diretorio de trabalho
 * @returns {Object}
 */
function inferReadOnlyEvidenceFromCommand(command = '', cwd = process.cwd()) {
    const tokens = shellSplit(command);
    if (!tokens.length) {
        return {
            filesRead: [],
            filesWritten: [],
            modifiedFiles: [],
            touchedFiles: [],
        };
    }
    const executable = path.basename(tokens[0]);
    const lastToken = tokens[tokens.length - 1];
    const maybeFile = lastToken && !lastToken.startsWith('-')
        ? path.resolve(cwd, lastToken)
        : null;
    const evidence = {
        filesRead: [],
        filesWritten: [],
        modifiedFiles: [],
        touchedFiles: [],
    };
    const isReadOnlyCommand = ['cat', 'grep', 'rg', 'head', 'tail', 'less', 'more', 'nl', 'wc'].includes(executable) ||
        (executable === 'sed' && tokens.includes('-n')) ||
        executable === 'awk';
    if (isReadOnlyCommand && maybeFile) {
        evidence.filesRead.push(maybeFile);
    }
    return {
        filesRead: uniquePaths(evidence.filesRead),
        filesWritten: [],
        modifiedFiles: [],
        touchedFiles: [],
    };
}
module.exports = {
    shellSplit,
    normalizeCommandSignature,
    isInspectionCommand,
    isMutationCommand,
    commandTargetsOnlySpecialFiles,
    isMeaningfulCommand,
    looksLikeMutationCommand,
    extractMutationCandidateFiles,
    extractRedirectionTargets,
    inferReadOnlyEvidenceFromCommand
};
