/**
 * Step responsável por tratar sucesso na execução de tarefas.
 * Inclui logging, finalização na API, movimentação de arquivos e liberação de lock.
 */

const container = require('../container');

class TaskSuccessStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    // Inicialização básica de logs e config primeiro
    this.log = options.log || container.resolve('log');
    this.config = options.config || container.resolve('config');
    this.axios = options.axios || container.resolve('axios');
    
    // Serviços auxiliares com injeção ou factory resiliente
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

      if (typeof LockServiceClass !== 'function') {
        throw new Error('LockServiceClass não pôde ser resolvido como um construtor');
      }

      return new LockServiceClass(LOCK_FILE);
    } catch (err) {
      // Retorna um objeto mockado seguro para evitar que o construtor quebre o pipeline
      return { releaseLock: async () => { throw new Error('Serviço de Lock indisponível'); } };
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

      if (typeof MonitorStateServiceClass !== 'function') {
        throw new Error('MonitorStateServiceClass não pôde ser resolvido como um construtor');
      }

      return new MonitorStateServiceClass(TASKS_DIR);
    } catch (err) {
      return { cleanupTask: async () => {} };
    }
  }

  /**
   * Cria instância do TaskFileService de forma resiliente
   * @private
   */
  _createTaskFileService() {
    try {
      const TaskFileServiceClass = container.resolve('TaskFileServiceClass');
      
      if (typeof TaskFileServiceClass !== 'function') {
        throw new Error('TaskFileServiceClass não pôde ser resolvido como um construtor');
      }

      return new TaskFileServiceClass();
    } catch (err) {
      return { moveTaskFiles: async () => { throw new Error('TaskFileService indisponível'); } };
    }
  }

  /**
   * Executa o step de tratamento de sucesso
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa executada com sucesso
   * @param {Object} context.executionResult - Resultado da execução
   * @param {string} context.userId - ID do usuário
   * @param {string} context.apiUrl - URL da API
   * @returns {Promise<Object>} Contexto atualizado com resultado
   */
  async execute(context) {
    const { task, executionResult } = context;
    const userId = context.userId || this.config.MY_USER_ID || null;
    const apiUrl = context.apiUrl || this.config.API_URL;
    const { TASKS_DIR, PROCESSED_DIR } = this.config;
    
    if (!task || !executionResult) {
      await this.log(`⚠️ TaskSuccessStep: task ou executionResult não fornecidos`);
      return {
        ...context,
        successResult: {
          success: false,
          error: 'task ou executionResult não fornecidos'
        }
      };
    }

    try {
      await this.log(`✅ Tarefa ${task.id} executada com sucesso!`);
      
      // 1. Atualiza status da tarefa na API (se tiver userId)
      if (userId) {
        try {
          await this.axios.patch(`${apiUrl}/api/tasks/${task.id}/finalize`, {
            userId,
            executionNotes: executionResult.executionNotes || 'Executado com sucesso'
          });
          await this.log(`📝 Tarefa ${task.id} finalizada na API`);
        } catch (apiError) {
          await this.log(`❌ Erro ao finalizar a tarefa na API: ${apiError.message}`);
        }
      } else {
        await this.log(`⚠️ Não foi possível finalizar tarefa na API pois userId é nulo.`);
      }

      // 2. Move arquivos para pasta de processados
      await this.taskFileService.moveTaskFiles(task.id, TASKS_DIR, PROCESSED_DIR);
      await this.log(`📁 Arquivos da tarefa ${task.id} movidos para ${PROCESSED_DIR}`);

      // 3. Limpa estado interno
      await this.stateService.cleanupTask(task.id);
      await this.log(`🧹 Estado da tarefa ${task.id} limpo`);

      // 4. Libera o lock para marcar isExecuting: false
      try {
        await this.lockService.releaseLock();
        await this.log(`🔓 Lock liberado para tarefa ${task.id} (isExecuting: false)`);
      } catch (lockError) {
        await this.log(`⚠️ Erro ao liberar lock: ${lockError.message}`);
      }
      
      await this.log(`✅ Sucesso da tarefa ${task.id} tratado com sucesso`);
      
      return {
        ...context,
        successResult: {
          success: true,
          taskId: task.id,
          actionsTaken: [
            'logged',
            userId ? 'apiFinalized' : 'apiSkipped',
            'filesMoved',
            'stateCleaned',
            'lockReleased'
          ]
        }
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no TaskSuccessStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        successResult: {
          success: false,
          error: stepError.message,
          taskId: task.id
        },
        shouldAbort: true,
        abortReason: `Falha no tratamento de sucesso: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} task - Tarefa executada com sucesso
   * @param {Object} executionResult - Resultado da execução
   * @param {string} userId - ID do usuário (opcional)
   * @returns {Promise<Object>} Resultado da operação
   */
  static async handleSuccess(task, executionResult, userId = null) {
    const step = new TaskSuccessStep();
    const result = await step.execute({ task, executionResult, userId });
    return result.successResult;
  }
}

module.exports = TaskSuccessStep;