// src/services/LockService.ts
/**
 * Servico de gerenciamento de locks para o monitor
 */

import fs from 'fs/promises';
import { execSync } from 'child_process'; // Import movido para o topo
import { fileExists } from '../utils/fileUtils';
import taskService from "./taskService";

class LockService {
  private lockFilePath: string;
  private currentTaskId: string | null;

  constructor(lockFilePath: string) {
    this.lockFilePath = lockFilePath;
    this.currentTaskId = null;
  }

  /**
   * Verifica se um processo esta ativo pelo PID
   */
  async isProcessAlive(pid: number): Promise<boolean> {
    try {
      if (!pid || pid <= 0) return false;
      
      // Método 1: Teste básico com signal 0 (padrão POSIX)
      try {
        process.kill(pid, 0);
      } catch (err: any) {
        // ESRCH significa que o processo não existe
        return err.code !== 'ESRCH';
      }
      
      // Método 2: Verificação via ps para mais confiança (Unix/Linux)
      if (process.platform !== 'win32') {
        try {
          // Verifica se processo existe via shell
          const cmd = `ps -p ${pid} > /dev/null 2>&1; echo $?`;
          const exitCode = execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
          
          if (exitCode !== '0') return false;
          
          // Verificação extra de comando (opcional, para debug)
          const cmd2 = `ps -p ${pid} -o command=`;
          const command = execSync(cmd2, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
          
          if (!command.includes('node') && !command.includes('monitor')) {
            console.log(`⚠️ LockService: PID ${pid} ativo, mas comando suspeito: ${command.substring(0, 50)}...`);
          }
          
          return true;
        } catch (error: any) {
          console.log(`⚠️ LockService: ps falhou para PID ${pid}, confiando no signal 0: ${error.message}`);
          return true; 
        }
      }
      
      return true; // No Windows, confiamos no sinal 0 do process.kill
    } catch (error) {
      return false;
    }
  }

  /**
   * Verifica se ha um lock ativo
   */
  async checkLock(timeoutThresholdMs = 0): Promise<any> {
    if (!await fileExists(this.lockFilePath)) {
      return { locked: false, pid: null };
    }
    try {
      const stat = await fs.stat(this.lockFilePath);
      const mtime = stat.mtimeMs;
      const age = Date.now() - mtime;

      const pidRaw = await fs.readFile(this.lockFilePath, 'utf8');
      const pid = parseInt(pidRaw.trim(), 10);
      
      if (Number.isNaN(pid)) {
        return { locked: false, pid: null, corrupted: true };
      }

      // Se o lock é recente, consideramos travado sem checar o processo (evita race conditions)
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
    } catch (error: any) {
      console.error(`❌ LockService: Erro ao verificar lock: ${error.message}`);
      return { locked: false, pid: null, error: error.message };
    }
  }

  /**
   * Adquire o lock e marca a tarefa como em execução
   */
  async acquireLock(taskId: string | null = null): Promise<boolean> {
    try {
      this.currentTaskId = taskId;
      
      // Criar arquivo de lock com o PID atual
      await fs.writeFile(this.lockFilePath, process.pid.toString());
      
      if (taskId) {
        try {
          // Atualiza via TaskService (que já emite SSE internamente)
          await taskService.updateTask(taskId, { isExecuting: true });
          console.log(`✅ LockService: Tarefa "${taskId}" marcada como isExecuting: true`);
        } catch (taskError: any) {
          console.error(`❌ LockService: Erro ao marcar tarefa no banco: ${taskError.message}`);
        }
      }
      
      return true;
    } catch (error: any) {
      console.error(`❌ LockService: Erro ao adquirir lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Libera o lock e marca a tarefa como não mais em execução
   */
  async releaseLock(): Promise<boolean> {
    try {
      let lockReleased = false;
      
      if (await fileExists(this.lockFilePath)) {
        await fs.unlink(this.lockFilePath);
        lockReleased = true;
      }
      
      if (this.currentTaskId) {
        try {
          await taskService.updateTask(this.currentTaskId, { isExecuting: false });
          console.log(`✅ LockService: Tarefa "${this.currentTaskId}" liberada.`);
        } catch (taskError: any) {
          console.error(`❌ LockService: Erro ao liberar tarefa no banco: ${taskError.message}`);
        }
        this.currentTaskId = null;
      }
      
      return lockReleased;
    } catch (error: any) {
      console.error(`❌ LockService: Erro ao liberar lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Forca a remocao do lock (para processos órfãos)
   */
  async forceReleaseLock(): Promise<boolean> {
    try {
      await fs.unlink(this.lockFilePath).catch(() => {});
      
      if (this.currentTaskId) {
        await taskService.updateTask(this.currentTaskId, { isExecuting: false });
        this.currentTaskId = null;
      }
      
      return true;
    } catch (error: any) {
      console.error(`❌ LockService (force): Erro ao forçar liberação: ${error.message}`);
      return false;
    }
  }

  /**
   * Mata um processo e libera o lock
   */
  async killAndRelease(pid: number): Promise<boolean> {
    console.warn(`⚠️ LockService: Tentando encerrar processo ${pid}...`);
    
    try {
      if (pid) {
        try {
          process.kill(pid, 'SIGTERM');
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {}
        
        const stillAlive = await this.isProcessAlive(pid);
        if (stillAlive) {
          console.warn(`⚠️ LockService: PID ${pid} ignorou SIGTERM. Enviando SIGKILL.`);
          try { process.kill(pid, 'SIGKILL'); } catch (e) {}
        }
      }
    } catch (error) {}

    return await this.forceReleaseLock();
  }
}

export default LockService;