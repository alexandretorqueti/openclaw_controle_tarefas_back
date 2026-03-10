// src/services/lockService.js
// Servico de gerenciamento de locks para o monitor

const fs = require('fs').promises;
const { fileExists } = require('../utils/fileUtils');

class LockService {
  constructor(lockFilePath) {
    this.lockFilePath = lockFilePath;
  }

  /**
   * Verifica se um processo esta ativo pelo PID
   * @param {number} pid - Process ID
   * @returns {Promise<boolean>}
   */
  async isProcessAlive(pid) {
    try {
      if (!pid) return false;
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se ha um lock ativo
   * @returns {Promise<{locked: boolean, pid: number|null}>}
   */
  async checkLock() {
    if (!await fileExists(this.lockFilePath)) {
      return { locked: false, pid: null };
    }

    try {
      const pidRaw = await fs.readFile(this.lockFilePath, 'utf8');
      const pid = parseInt(String(pidRaw).trim(), 10);

      if (Number.isNaN(pid)) {
        return { locked: false, pid: null, corrupted: true };
      }

      const alive = await this.isProcessAlive(pid);
      return { locked: alive, pid, alive };
    } catch (error) {
      return { locked: false, pid: null, error: error.message };
    }
  }

  /**
   * Adquire o lock
   * @returns {Promise<boolean>}
   */
  async acquireLock() {
    try {
      await fs.writeFile(this.lockFilePath, process.pid.toString());
      return true;
    } catch (error) {
      console.error(`Erro ao adquirir lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Libera o lock
   * @returns {Promise<boolean>}
   */
  async releaseLock() {
    try {
      if (await fileExists(this.lockFilePath)) {
        await fs.unlink(this.lockFilePath);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`Erro ao liberar lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Forca a remocao do lock (para locks orfaos)
   * @returns {Promise<boolean>}
   */
  async forceReleaseLock() {
    try {
      await fs.unlink(this.lockFilePath).catch(() => {});
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Tenta matar um processo e liberar o lock
   * @param {number} pid - PID do processo
   * @returns {Promise<boolean>}
   */
  async killAndRelease(pid) {
    try {
      if (pid) {
        process.kill(pid, 'SIGKILL');
      }
    } catch (error) {
      // Processo ja morto
    }

    return await this.forceReleaseLock();
  }
}

module.exports = LockService;
