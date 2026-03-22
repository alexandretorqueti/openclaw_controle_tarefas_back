// src/utils/fileUtils.js
// Utilitarios para operacoes com arquivos

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Verifica se um arquivo existe de forma assincrona
 * @param {string} pathToCheck - Caminho do arquivo
 * @returns {Promise<boolean>}
 */
async function fileExists(pathToCheck) {
  try {
    await fs.access(pathToCheck);
    return true;
  } catch {
    return false;
  }
}

/**
 * Verifica se um arquivo existe de forma sincrona
 * @param {string} pathToCheck - Caminho do arquivo
 * @returns {boolean}
 */
function fileExistsSync(pathToCheck) {
  return fsSync.existsSync(pathToCheck);
}

/**
 * Le conteudo de um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @param {string} encoding - Encoding (default: utf8)
 * @returns {Promise<string|null>}
 */
async function safeReadFile(filePath, encoding = 'utf8') {
  try {
    return await fs.readFile(filePath, encoding);
  } catch (error) {
    return null;
  }
}

/**
 * Escreve conteudo em um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @param {string} content - Conteudo a escrever
 * @param {string} encoding - Encoding (default: utf8)
 * @returns {Promise<boolean>}
 */
async function safeWriteFile(filePath, content, encoding = 'utf8') {
  try {
    const dir = path.dirname(filePath);
    if (!fsSync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
    await fs.writeFile(filePath, content, encoding);
    return true;
  } catch (error) {
    console.error(`Erro ao escrever arquivo ${filePath}: ${error.message}`);
    return false;
  }
}

/**
 * Remove um arquivo de forma segura
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<boolean>}
 */
async function safeUnlink(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Move um arquivo de forma segura
 * @param {string} sourcePath - Caminho de origem
 * @param {string} destPath - Caminho de destino
 * @returns {Promise<boolean>}
 */
async function safeMoveFile(sourcePath, destPath) {
  try {
    const destDir = path.dirname(destPath);
    if (!fsSync.existsSync(destDir)) {
      await fs.mkdir(destDir, { recursive: true });
    }
    await fs.rename(sourcePath, destPath);
    return true;
  } catch (error) {
    console.error(`Erro ao mover arquivo: ${error.message}`);
    return false;
  }
}

/**
 * Gera fingerprint de um arquivo (hash + metadata)
 * @param {string} filePath - Caminho do arquivo
 * @returns {Promise<Object>}
 */
async function fingerprintFile(filePath) {
  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      return {
        exists: true,
        type: 'non-file',
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash: null
      };
    }

    const content = await fs.readFile(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      exists: true,
      type: 'file',
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }
    return { exists: false, error: error.message };
  }
}

/**
 * Gera fingerprint de um arquivo de forma sincrona
 * @param {string} filePath - Caminho do arquivo
 * @returns {Object}
 */
function fingerprintFileSync(filePath) {
  try {
    const stat = fsSync.statSync(filePath);

    if (!stat.isFile()) {
      return {
        exists: true,
        type: 'non-file',
        size: stat.size,
        mtimeMs: stat.mtimeMs,
        hash: null
      };
    }

    const content = fsSync.readFileSync(filePath);
    const hash = crypto.createHash('sha256').update(content).digest('hex');

    return {
      exists: true,
      type: 'file',
      size: stat.size,
      mtimeMs: stat.mtimeMs,
      hash
    };
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { exists: false };
    }
    return { exists: false, error: error.message };
  }
}

/**
 * Coleta fingerprints de multiplos arquivos
 * @param {string[]} files - Lista de caminhos
 * @returns {Promise<Object>}
 */
async function collectFingerprints(files = []) {
  const result = {};
  const uniqueFiles = [...new Set(files.filter(Boolean).map(f => path.resolve(f)))];
  
  for (const file of uniqueFiles) {
    result[file] = await fingerprintFile(file);
  }
  
  return result;
}

/**
 * Compara fingerprints antes e depois para detectar mudancas
 * @param {Object} before - Fingerprints antes
 * @param {Object} after - Fingerprints depois
 * @returns {string[]} - Arquivos que mudaram
 */
function diffFingerprints(before = {}, after = {}) {
  const allFiles = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const changed = [];

  for (const file of allFiles) {
    const prev = before[file] || { exists: false };
    const next = after[file] || { exists: false };

    const existenceChanged = prev.exists !== next.exists;
    const typeChanged = prev.type !== next.type;
    const sizeChanged = prev.size !== next.size;
    const hashChanged = prev.hash !== next.hash;

    if (existenceChanged || typeChanged || sizeChanged || hashChanged) {
      changed.push(file);
    }
  }

  return changed;
}

/**
 * Verifica se fingerprint mudou (versao simplificada)
 * @param {Object} before - Fingerprint antes
 * @param {Object} after - Fingerprint depois
 * @returns {boolean}
 */
function didFingerprintChange(before = {}, after = {}) {
  return diffFingerprints({ file: before }, { file: after }).length > 0;
}

/**
 * Trunca output longo
 * @param {string} text - Texto a truncar
 * @param {number} max - Tamanho maximo (default: 20000)
 * @returns {string}
 */
function truncateOutput(text, max = 20000) {
  const value = String(text || '');
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n...[OUTPUT TRUNCADO]`;
}

/**
 * Verifica se um arquivo é um artefato efêmero (temporário, log, sistema)
 * que não deve ser considerado como evidência significativa da execução da tarefa.
 * @param {string} filePath - Caminho do arquivo
 * @returns {boolean}
 */
function isEphemeralArtifact(filePath) {
  if (!filePath) return false;
  
  const fileName = path.basename(filePath).toLowerCase();
  const fileExt = path.extname(filePath).toLowerCase();
  const dirName = path.dirname(filePath).toLowerCase();
  
  // Extensões de arquivos temporários/efêmeros
  const ephemeralExtensions = [
    '.log', '.tmp', '.temp', '.bak', '.backup', '.old', '.orig', '.swp',
    '.pid', '.lock', '.cache', '.db', '.sqlite', '.sqlite3'
  ];
  
  // Nomes de arquivos efêmeros
  const ephemeralFileNames = [
    '.done', '.ds_store', 'thumbs.db', 'desktop.ini',
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'node_modules', '.git', '.svn', '.hg', '.vscode', '.idea'
  ];
  
  // Padrões de caminhos de sistema/processo
  const systemPathPatterns = [
    /node_modules/,
    /\.git/,
    /\.cache/,
    /\.npm/,
    /\.yarn/,
    /\.pnpm/,
    /tmp\//,
    /temp\//,
    /\/log(s?)\//,
    /\/var\/log\//,
    /\/proc\//,
    /\/sys\//,
    /\/dev\//
  ];
  
  // Verificar por extensão
  if (ephemeralExtensions.includes(fileExt)) {
    return true;
  }
  
  // Verificar por nome de arquivo
  if (ephemeralFileNames.some(name => fileName.includes(name))) {
    return true;
  }
  
  // Verificar por padrões de caminho
  const normalizedPath = filePath.toLowerCase();
  if (systemPathPatterns.some(pattern => pattern.test(normalizedPath))) {
    return true;
  }
  
  // Arquivos muito pequenos (menos de 10 bytes) provavelmente são marcadores
  try {
    const stats = fsSync.statSync(filePath);
    if (stats.size < 10) {
      return true;
    }
  } catch (e) {
    // Se não conseguir verificar tamanho, assume não é efêmero
  }
  
  return false;
}

module.exports = {
  fileExists,
  fileExistsSync,
  safeReadFile,
  safeWriteFile,
  safeUnlink,
  safeMoveFile,
  fingerprintFile,
  fingerprintFileSync,
  collectFingerprints,
  diffFingerprints,
  didFingerprintChange,
  truncateOutput,
  isEphemeralArtifact
};
