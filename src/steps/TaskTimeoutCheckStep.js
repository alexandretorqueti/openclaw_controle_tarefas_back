

/**
 * Step responsável por verificar timeout de tarefas em execução.
 * Mata processos que excederam o limite crítico e limpa o sistema.
 */

const container = require('../container');

class TaskTimeoutCheckStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    this.config = options.config || container.resolve('config');
    this.timeUtils = options.timeUtils || container.resolve('timeUtils');
    
    // Usar instâncias fornecidas ou criar do container via factories resilientes
    this.lockService = options.lockService || this._createLockService();
    this.stateService = options.stateService || this._createStateService();
    this.taskFileService = options.taskFileService || this._createTaskFileService();
  }

  /**
   * Cria instância do LockService com configuração de forma resiliente
   * @private
   */
  _createLockService() {
    try {
      const LockServiceClass = container.resolve('LockServiceClass');
      const config = this.config || container.resolve('config') || {};
      const { LOCK_FILE } = config;

      if (typeof LockServiceClass !== 'function') throw new Error();

      return new LockServiceClass(LOCK_FILE);
    } catch (err) {
      return { killAndRelease: async () => {} };
    }
  }

  /**
   * Cria instância do MonitorStateService com configuração de forma resiliente
   * @private
   */
  _createStateService() {
    try {
      const MonitorStateServiceClass = container.resolve('MonitorStateServiceClass');
      const config = this.config || container.resolve('config') || {};
      const { TASKS_DIR } = config;

      if (typeof MonitorStateServiceClass !== 'function') throw new Error();

      return new MonitorStateServiceClass(TASKS_DIR);
    } catch (err) {
      return { getActiveTasks: async () => ({}), cleanupTask: async () => {} };
    }
  }

  /**
   * Cria instância do TaskFileService de forma resiliente
   * @private
   */
  _createTaskFileService() {
    try {
      const TaskFileServiceClass = container.resolve('TaskFileServiceClass');
      if (typeof TaskFileServiceClass !== 'function') throw new Error();
      return new TaskFileServiceClass();
    } catch (err) {
      return { moveTaskFiles: async () => {} };
    }
  }

  /**
   * Executa o step de verificação de timeout
   * @param {Object} context - Contexto do pipeline
   * @param {number} context.pid - PID do processo a verificar
   * @param {number} context.taskTimeoutMs - Timeout da tarefa em ms
   * @returns {Promise<Object>} Contexto atualizado
   */
  async execute(context) {
    const { pid } = context;
    const taskTimeoutMs = context.taskTimeoutMs || this.config.TASK_TIMEOUT_MS;
    const { TASKS_DIR, ERROR_DIR } = this.config;
    
    if (!pid) {
      await this.log(`⚠️ TaskTimeoutCheckStep: pid não fornecido`);
      return {
        ...context,
        timeoutCheckResult: { success: false, error: 'pid não fornecido' }
      };
    }

    try {
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
      
      const GRACE_PERIOD_MS = 60000; // 1 minuto de carência

      await this.log(`⏱️ Tarefa ${taskId} em execução por ${this.timeUtils.segundosToMinutos_Segundos(elapsed / 1000)}.`);

      // 1. LIMITE CRÍTICO: Timeout + Carência
      if (elapsed > taskTimeoutMs + GRACE_PERIOD_MS) {
        await this.log(`💀 CEIFADOR: Tarefa ${taskId} excedeu o limite crítico.`);
        await this.lockService.killAndRelease(pid);
        await this.taskFileService.moveTaskFiles(taskId, TASKS_DIR, ERROR_DIR);
        await this.stateService.cleanupTask(taskId);
        
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'killed_and_cleaned',
            taskId,
            pid,
            elapsedMs: elapsed,
            actionsTaken: ['killed_process', 'released_lock', 'moved_files', 'cleaned_state']
          }
        };
      } 
      // 2. TIMEOUT ORIGINAL: Entrou na carência
      else if (elapsed > taskTimeoutMs) {
        await this.log(`⚠️ ALERTA: Tarefa ${taskId} excedeu o tempo limite. Aguardando carência.`);
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'warning_only',
            taskId,
            pid,
            elapsedMs: elapsed,
            message: 'Tarefa em período de carência'
          }
        };
      }
      // 3. OK
      else {
        await this.log(`✅ Tarefa ${taskId} dentro do tempo limite.`);
        return {
          ...context,
          timeoutCheckResult: {
            success: true,
            action: 'within_timeout',
            taskId,
            pid,
            elapsedMs: elapsed
          }
        };
      }
      
    } catch (stepError) {
      await this.log(`💥 Erro no TaskTimeoutCheckStep para PID ${pid}: ${stepError.message}`);
      return {
        ...context,
        timeoutCheckResult: { success: false, error: stepError.message, pid },
        shouldAbort: true,
        abortReason: `Falha na verificação de timeout: ${stepError.message}`
      };
    }
  }

  static async checkTimeout(pid, taskTimeoutMs = null) {
    const step = new TaskTimeoutCheckStep();
    const result = await step.execute({ pid, taskTimeoutMs });
    return result.timeoutCheckResult;
  }
}

module.exports = TaskTimeoutCheckStep;

