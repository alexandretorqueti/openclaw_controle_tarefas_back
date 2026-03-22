// src/steps/TaskTimeoutCheckStep.ts
/**
 * Step responsável por verificar timeout de tarefas em execução.
 * Mata processos que excederam o limite crítico e limpa o sistema.
 */

import container from '../container';

class TaskTimeoutCheckStep {
  // 1. Declaração explícita de todas as dependências
  private log: any;
  private config: any;
  private timeUtils: any;
  private lockService: any;
  private stateService: any;
  private taskFileService: any;

  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options: any = {}) {
    this.log = container.get('log');
    this.config = container.get('config');
    this.timeUtils = container.get('timeUtils');
    
    // Usar instâncias fornecidas ou criar do container
    this.lockService = options.lockService || this._createLockService();
    this.stateService = options.stateService || this._createStateService();
    this.taskFileService = options.taskFileService || this._createTaskFileService();
  }

  /**
   * Cria instância do LockService com configuração
   */
  private _createLockService(): any {
    // A correção mágica do TypeScript aqui (as any)
    const LockServiceClass = container.get('LockServiceClass') as any;
    const { LOCK_FILE } = this.config;
    return new LockServiceClass(LOCK_FILE);
  }

  /**
   * Cria instância do MonitorStateService com configuração
   */
  private _createStateService(): any {
    const MonitorStateServiceClass = container.get('MonitorStateServiceClass') as any;
    const { TASKS_DIR } = this.config;
    return new MonitorStateServiceClass(TASKS_DIR);
  }

  /**
   * Cria instância do TaskFileService
   */
  private _createTaskFileService(): any {
    const TaskFileServiceClass = container.get('TaskFileServiceClass') as any;
    return new TaskFileServiceClass();
  }

  /**
   * Executa o step de verificação de timeout
   */
  async execute(context: any): Promise<any> {
    const { pid } = context;
    const taskTimeoutMs = context.taskTimeoutMs || this.config.TASK_TIMEOUT_MS;
    const { TASKS_DIR, ERROR_DIR } = this.config;
    
    if (!pid) {
      await this.log(`⚠️ TaskTimeoutCheckStep: pid não fornecido`);
      return {
        ...context,
        timeoutCheckResult: {
          success: false,
          error: 'pid não fornecido'
        }
      };
    }

    try {
      // 1. Obtém tarefas ativas
      const activeTasks = await this.stateService.getActiveTasks();
      const taskIds = Object.keys(activeTasks);
      
      if (taskIds.length === 0) {
        await this.log(`ℹ️ Nenhuma tarefa ativa para verificar timeout`);
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'no_active_tasks',
            message: 'Nenhuma tarefa ativa para verificar'
          }
        };
      }

      const now = Date.now();
      const taskId = taskIds[0];
      const task = activeTasks[taskId];
      const elapsed = now - task.startTime;
      
      const GRACE_PERIOD_MS = 60000; // 1 minuto de carência após o timeout

      await this.log(`⏱️ Tarefa ${taskId} em execução por ${this.timeUtils.segundosToMinutos_Segundos(elapsed / 1000)}.`);

      // 2. Verifica se excedeu o limite crítico (timeout + grace period)
      if (elapsed > taskTimeoutMs + GRACE_PERIOD_MS) {
        await this.log(`💀 CEIFADOR: Tarefa ${taskId} excedeu o limite crítico (Timeout + 1m).`);
        await this.log(`⚰️ Encerrando processo ${pid}, desbloqueando sistema e movendo arquivos para ERROR.`);

        // Mata o processo e remove o arquivo de lock
        await this.lockService.killAndRelease(pid);
        
        // Move arquivos para a pasta de erro
        await this.taskFileService.moveTaskFiles(taskId, TASKS_DIR, ERROR_DIR);
        
        // Limpa o estado interno
        await this.stateService.cleanupTask(taskId);
        
        await this.log(`🧹 Sistema recuperado. O próximo ciclo poderá assumir a fila.`);
        
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'killed_and_cleaned',
            taskId,
            pid,
            elapsedMs: elapsed,
            exceededByMs: elapsed - (taskTimeoutMs + GRACE_PERIOD_MS),
            actionsTaken: ['killed_process', 'released_lock', 'moved_files', 'cleaned_state']
          }
        };
      } 
      // 3. Verifica se excedeu apenas o timeout original (mas ainda está na grace period)
      else if (elapsed > taskTimeoutMs) {
        await this.log(`⚠️ ALERTA: Tarefa ${taskId} excedeu o tempo limite original. Aguardando carência de 1 minuto antes de intervir.`);
        
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'warning_only',
            taskId,
            pid,
            elapsedMs: elapsed,
            remainingGraceMs: (taskTimeoutMs + GRACE_PERIOD_MS) - elapsed,
            message: 'Tarefa excedeu timeout, mas ainda está no período de carência'
          }
        };
      }
      // 4. Tarefa ainda dentro do timeout
      else {
        await this.log(`✅ Tarefa ${taskId} dentro do tempo limite.`);
        
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'within_timeout',
            taskId,
            pid,
            elapsedMs: elapsed,
            remainingMs: taskTimeoutMs - elapsed
          }
        };
      }
      
    } catch (stepError: any) {
      await this.log(`💥 Erro no TaskTimeoutCheckStep para PID ${pid}: ${stepError.message}`);
      
      return {
        ...context,
        timeoutCheckResult: {
          success: false,
          error: stepError.message,
          pid
        },
        shouldAbort: true,
        abortReason: `Falha na verificação de timeout: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   */
  static async checkTimeout(pid: number, taskTimeoutMs: number | null = null): Promise<any> {
    const step = new TaskTimeoutCheckStep();
    const result = await step.execute({ pid, taskTimeoutMs });
    return result.timeoutCheckResult;
  }
}

export default TaskTimeoutCheckStep;