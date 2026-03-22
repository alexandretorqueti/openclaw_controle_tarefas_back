// Migrado para TypeScript - Fase: Services
// Arquivo: lockService.js

export // src/services/lockService.js
// Servico de gerenciamento de locks para o monitor

import fs from 'fs/promises';
import { fileExists } from '../utils/fileUtils';
import taskHierarchyService from "./taskHierarchyService";
import sseService from "./sseService"; // <-- 1. Importa o serviço SSE
import taskService from "./taskService"; // <-- 2. Importa o TaskService

class LockService {
  constructor(lockFilePath) {
    (this as any).lockFilePath = lockFilePath;
    (this as any).currentTaskId = null;
  }

  /**
   * Verifica se um processo esta ativo pelo PID
   * @param {number} pid - Process ID
   * @returns {Promise<boolean>}
   */
  async isProcessAlive(pid): Promise<any> {
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
        import { execSync } from 'child_process';
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
  async checkLock(timeoutThresholdMs = 0): Promise<any> {
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
   * Adquire o lock e marca a tarefa como em execução
   * @param {string} taskId - ID da tarefa que será executada
   * @returns {Promise<boolean>}
   */
  async acquireLock(taskId = null): Promise<any> {
    try {
      // Armazenar taskId para uso posterior
      (this as any).currentTaskId = taskId;
      
      // Criar arquivo de lock
      await fs.writeFile(this.lockFilePath, process.pid.toString());
      
      // Se temos um taskId, marcar a tarefa como isExecuting: true
      if (taskId) {
        try {
          // OBS: A lógica de desmarcar outras tarefas que estavam em execução
          // agora deve ser feita caso a caso ou via um método específico no TaskService
          // se for um requisito estrito. Por ora, atualizamos apenas a tarefa alvo.

          const updated = await taskService.updateTask(taskId, { isExecuting: true });
          console.log(`✅ LockService: Tarefa "${taskId}" marcada como isExecuting: true`);
          
          // O TaskService.updateTask já cuida de atualizar a hierarquia internamente 
          // e de emitir o sseService.broadcast('task_updated', updated), 
          // então não precisamos duplicar isso aqui!
          
        } catch (taskError) {
          console.error(`❌ LockService: Erro ao marcar tarefa como em execução: ${taskError.message}`);
          // Continuar mesmo com erro - o lock foi adquirido
        }
      }
      
      return true;
    } catch (error) {
      console.error(`❌ LockService: Erro ao adquirir lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Libera o lock e marca a tarefa como não mais em execução
   * @returns {Promise<boolean>}
   */
  async releaseLock(): Promise<any> {
    try {
      let lockReleased = false;
      
      // Remover arquivo de lock
      if (await fileExists(this.lockFilePath)) {
        await fs.unlink(this.lockFilePath);
        lockReleased = true;
      }
      
      // Se temos um taskId, marcar a tarefa como isExecuting: false
      if (this.currentTaskId) {
        try {
          // O updateTask já lida com a hierarquia e os eventos SSE
          await taskService.updateTask(this.currentTaskId, { isExecuting: false });
          console.log(`✅ LockService: Tarefa "${this.currentTaskId}" marcada como isExecuting: false`);
          
        } catch (taskError) {
          console.error(`❌ LockService: Erro ao marcar tarefa como finalizada: ${taskError.message}`);
          // Continuar mesmo com erro - o lock foi liberado
        }
        
        // Limpar taskId atual
        (this as any).currentTaskId = null;
      }
      
      return lockReleased;
    } catch (error) {
      console.error(`❌ LockService: Erro ao liberar lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Forca a remocao do lock (para locks orfaos) e marca tarefa como não mais em execução
   * @returns {Promise<boolean>}
   */
  async forceReleaseLock(): Promise<any> {
    try {
      // Remover arquivo de lock
      await fs.unlink(this.lockFilePath).catch(() => {});
      
      // Se temos um taskId, marcar a tarefa como isExecuting: false
      if (this.currentTaskId) {
        try {
          // O updateTask já lida com a hierarquia e os eventos SSE
          await taskService.updateTask(this.currentTaskId, { isExecuting: false });
          console.log(`✅ LockService (force): Tarefa "${this.currentTaskId}" marcada como isExecuting: false`);
          
        } catch (taskError) {
          console.error(`❌ LockService (force): Erro ao marcar tarefa como finalizada: ${taskError.message}`);
        }
        
        // Limpar taskId atual
        (this as any).currentTaskId = null;
      }
      
      return true;
    } catch (error) {
      console.error(`❌ LockService (force): Erro ao forçar liberação de lock: ${error.message}`);
      return false;
    }
  }

  /**
   * Tenta matar um processo e liberar o lock
   * ⚠️ PERIGOSO: Pode matar processos válidos
   * @param {number} pid - PID do processo
   * @returns {Promise<boolean>}
   */
  async killAndRelease(pid): Promise<any> {
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

export default LockService;