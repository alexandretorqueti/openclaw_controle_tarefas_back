/**
 * Converte segundos para formato "Xm Ys"
 * @param {number} segundos - Tempo em segundos
 * @returns {string}
 */
declare function segundosToMinutos_Segundos(segundos: any): string;
/**
 * Converte milissegundos para formato legivel
 * @param {number} ms - Tempo em milissegundos
 * @returns {string}
 */
declare function msToReadable(ms: any): string;
/**
 * Retorna timestamp formatado para logs
 * @param {Date} date - Data (default: now)
 * @returns {string}
 */
declare function getLogTimestamp(date?: Date): string;
/**
 * Verifica se uma data esta no passado
 * @param {Date} date - Data a verificar
 * @returns {boolean}
 */
declare function isPastDate(date: any): boolean;
/**
 * Adiciona minutos a uma data
 * @param {Date} date - Data base
 * @param {number} minutes - Minutos a adicionar
 * @returns {Date}
 */
declare function addMinutes(date: any, minutes: any): Date;
/**
 * Verifica se um processo esta ativo pelo PID
 * @param {number} pid - Process ID
 * @returns {Promise<boolean>}
 */
declare function isProcessAlive(pid: any): Promise<boolean>;
