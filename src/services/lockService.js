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
      if (!pid || pid <= 0) return false;
      
      // Método 1: Teste básico com signal 0
      try {
        process.kill(pid, 0);
      } catch (err) {
        return false; // Processo não existe ou sem permissão
      }
      
      // Método 2: Verificação via ps para mais confiança
      // Apenas em sistemas Unix/Linux
      if (process.platform !== 'win32') {
        const { execSync } = require('child_process');
        try {
          // Verifica se processo existe (qualquer processo)
          // Usando 'ps -p PID' que retorna 0 se processo existe
          const cmd = `ps -p ${pid} > /dev/null 2>&1; echo $?`;
          const exitCode = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
          
          // Se exit code não é 0, processo não existe
          if (exitCode !== '0') {
            return false;
          }
          
          // Processo existe, agora verifica se é Node (opcional)
          try {
            const cmd2 = `ps -p ${pid} -o command=`;
            const command = execSync(cmd2, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
            
            // Verifica se é processo Node (monitor.js ou similar)
            // Mas mesmo se não for Node, processo EXISTE, então retorna true
            // Apenas log para debug
            if (!command.includes('node') && !command.includes('monitor')) {
              console.log(`⚠️ Processo ${pid} existe mas não parece ser Node: ${command.substring(0, 50)}...`);
            }
            
            return true; // Processo existe, independente de ser Node ou não
          } catch (error) {
            // Se falhar ao pegar command, ainda assim processo existe
            return true;
          }
        } catch (error) {
          // Se ps falhar completamente, confia no método 1
          console.log(`⚠️ ps falhou para PID ${pid}: ${error.message}`);
          return true;
        }
      }
      
      return true; // Windows ou ps falhou, confia no método 1
    } catch (error) {
      return false;
    }
  }

/**
   * Verifica se ha um lock ativo
   * @param {number} timeoutThresholdMs - Tempo em ms para considerar o lock como "recente"
   * @returns {Promise<Object>}
   */
  async checkLock(timeoutThresholdMs = 0) {
    if (!await fileExists(this.lockFilePath)) {
      return { locked: false, pid: null };
    }
    try {
      const stat = await fs.stat(this.lockFilePath);
      const mtime = stat.mtimeMs;
      const age = Date.now() - mtime;

      const pidRaw = await fs.readFile(this.lockFilePath, 'utf8');
      const pid = parseInt(String(pidRaw).trim(), 10);
      
      if (Number.isNaN(pid)) {
        return { locked: false, pid: null, corrupted: true };
      }

      // REQUISITO 2: Se o lock existe e ainda não passou do tempo, nem olha o processo.
      if (timeoutThresholdMs > 0 && age < timeoutThresholdMs) {
        return { 
          locked: true, 
          pid, 
          alive: true, 
          ageRecent: true, 
          mtime 
        };
      }

      const alive = await this.isProcessAlive(pid);
      return { locked: alive, pid, alive, mtime };
    } catch (error) {
      console.error(`❌ LockService: Erro ao verificar lock: ${error.message}`);
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
   * ⚠️ PERIGOSO: Pode matar processos válidos
   * @param {number} pid - PID do processo
   * @returns {Promise<boolean>}
   */
  async killAndRelease(pid) {
    console.warn('⚠️ AVISO: killAndRelease chamado. Isso pode matar processos válidos!');
    
    try {
      if (pid) {
        // Primeiro tenta SIGTERM (graceful shutdown)
        try {
          process.kill(pid, 'SIGTERM');
          // Aguarda 2 segundos para graceful shutdown
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          // Processo já morreu ou não existe
        }
        
        // Verifica se processo ainda está vivo
        const stillAlive = await this.isProcessAlive(pid);
        if (stillAlive) {
          console.warn(`⚠️ Processo ${pid} ainda vivo após SIGTERM. Forçando com SIGKILL.`);
          process.kill(pid, 'SIGKILL');
        }
      }
    } catch (error) {
      // Processo já morto ou sem permissão
    }

    return await this.forceReleaseLock();
  }
}

module.exports = LockService;

