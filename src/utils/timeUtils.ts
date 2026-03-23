// src/utils/timeUtils.js
// Utilitarios para manipulacao de tempo

/**
 * Converte segundos para formato "Xm Ys"
 * @param {number} segundos - Tempo em segundos
 * @returns {string}
 */
function segundosToMinutos_Segundos(segundos) {
  const minutos = Math.floor(segundos / 60);
  const segundosRestantes = segundos % 60;
  return `${minutos}m ${segundosRestantes.toFixed(2)}s`;
}

/**
 * Converte milissegundos para formato legivel
 * @param {number} ms - Tempo em milissegundos
 * @returns {string}
 */
function msToReadable(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  return segundosToMinutos_Segundos(ms / 1000);
}

/**
 * Retorna timestamp formatado para logs
 * @param {Date} date - Data (default: now)
 * @returns {string}
 */
function getLogTimestamp(date = new Date()) {
  return date.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Verifica se uma data esta no passado
 * @param {Date} date - Data a verificar
 * @returns {boolean}
 */
function isPastDate(date) {
  return new Date(date) < new Date();
}

/**
 * Adiciona minutos a uma data
 * @param {Date} date - Data base
 * @param {number} minutes - Minutos a adicionar
 * @returns {Date}
 */
function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60000);
}

/**
 * Verifica se um processo esta ativo pelo PID
 * @param {number} pid - Process ID
 * @returns {Promise<boolean>}
 */
async function isProcessAlive(pid) {
  try {
    if (!pid) return false;
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

module.exports = {
  segundosToMinutos_Segundos,
  msToReadable,
  getLogTimestamp,
  isPastDate,
  addMinutes,
  isProcessAlive
};
