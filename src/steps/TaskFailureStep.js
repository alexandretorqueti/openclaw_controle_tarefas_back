// src/steps/TaskFailureStep.js
/**
 * Step responsável por tratar falhas na execução de tarefas.
 * Inclui logging, comentários, reatribuição, limpeza de locks e movimentação de arquivos.
 */

const container = require('../container');

class TaskFailureStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
 constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    this.config = options.config || container.resolve('config');
    this.axios = options.axios || container.resolve('axios');
    this.path = options.path || container.resolve('path');
    this.fileUtils = options.fileUtils || container.resolve('fileUtils');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    
    // Usar instâncias fornecidas ou criar do container
    this.lockService = options.lockService || this._createLockService();
    this.stateService = options.stateService || this._createStateService();
    this.taskFileService = options.taskFileService || this._createTaskFileService();
  }

  /**
   * Cria instância do LockService com configuração
   * @private
   */
  _createLockService() {
    const LockServiceClass = container.resolve('LockServiceClass');
    const { LOCK_FILE } = this.config;
    return new LockServiceClass(LOCK_FILE);
  }

  /**
   * Cria instância do MonitorStateService com configuração
   * @private
   */
  _createStateService() {
    const MonitorStateServiceClass = container.resolve('MonitorStateServiceClass');
    const { TASKS_DIR } = this.config;
    return new MonitorStateServiceClass(TASKS_DIR);
  }

  /**
   * Cria instância do TaskFileService
   * @private
   */
  _createTaskFileService() {
    const TaskFileServiceClass = container.resolve('TaskFileServiceClass');
    return new TaskFileServiceClass();
  }

  /**
   * Executa o step de tratamento de falha
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa que falhou
   * @param {Error} context.error - Erro que ocorreu
   * @param {string} context.userId - ID do usuário (opcional)
   * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
   * @returns {Promise<Object>} Contexto atualizado com resultado
   */
  async execute(context) {
    const { task, error } = context;
    const userId = context.userId || null;
    const apiUrl = context.apiUrl || this.config.API_URL;
    const { TASKS_DIR, ERROR_DIR } = this.config;
    
    if (!task || !error) {
      await this.log(`⚠️ TaskFailureStep: task ou error não fornecidos`);
      return {
        ...context,
        failureResult: {
          success: false,
          error: 'task ou error não fornecidos'
        }
      };
    }

    try {
      await this.log(`⚠️ ALERTA: Falha na execução da tarefa ${task.id}: ${error.message}`);
      
      // 1. Ler log do terminal se existir
      const terminalLogPath = this.path.join(TASKS_DIR, `terminal-${task.id}.log`);
      let terminalOutput = "";
      
      if (await this.fileUtils.fileExists(terminalLogPath)) {
        terminalOutput = await this.fileSystem.readFile(terminalLogPath, 'utf8');
      }
      await this.log(`✅ Log do terminal lido com sucesso: ${terminalOutput.substring(0, 1000)}`);

      // 2. Adicionar comentário sobre a falha se tivermos userId
      if (userId) {
        try {
          await this.axios.post(`${apiUrl}/api/comments`, {
            taskId: task.id,
            userId,
            content: `⚠️ **FALHA DE EXECUÇÃO LOCAL**\nErro: ${error.message}\n\nSaída do Terminal:\n${terminalOutput.substring(0, 1000)}`
          });
        } catch (commentError) {
          await this.log(`❌ Erro ao postar comentário de falha: ${commentError.message}`);
        }
      }
      await this.log(`✅ Comentário de falha postado com sucesso`);


      // 3. Tentar reatribuir para o desenvolvedor 'alexandre'
      await this._tryReassignTask(task, apiUrl);
      await this.log(`🚀 Tarefa ${task.id} reatribuida para o usuário 'alexandre'`);

      // 4. Liberar lock e limpar estado de execução
      await this._cleanupExecutionState(task);
      await this.log(`🔓 Lock liberado e estado de execução limpo`);

      // 5. Mover arquivos para pasta de erro
      await this.taskFileService.moveTaskFiles(task.id, TASKS_DIR, ERROR_DIR);
      await this.log(`✅ Arquivos da tarefa ${task.id} movidos para pasta de erro`);
      
      // 6. Limpar estado interno
      await this.stateService.cleanupTask(task.id);
      await this.log(`🧹 Estado interno da tarefa ${task.id} limpo`);
      
      await this.log(`✅ Falha da tarefa ${task.id} tratada com sucesso`);
      
      return {
        ...context,
        failureResult: {
          success: true,
          taskId: task.id,
          actionsTaken: [
            'logged',
            'commented',
            'reassigned',
            'lockReleased',
            'filesMoved',
            'stateCleaned'
          ]
        }
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no TaskFailureStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        failureResult: {
          success: false,
          error: stepError.message,
          taskId: task.id
        },
        shouldAbort: true,
        abortReason: `Falha no tratamento de erro: ${stepError.message}`
      };
    }
  }

  /**
   * Tenta reatribuir tarefa para o usuário 'alexandre'
   * @private
   */
  async _tryReassignTask(task, apiUrl) {
    try {
      const usersRes = await this.axios.get(`${apiUrl}/api/users`);
      const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
      
      if (dev) {
        await this.log(`👤 Reatribuindo tarefa ${task.id} para o usuário alexandre.`);
        await this.axios.put(`${apiUrl}/api/tasks/${task.id}`, { assignedToId: dev.id });
      } else {
        await this.log(`⚠️ Usuário 'alexandre' não encontrado na API`);
      }
    } catch (assignError) {
      await this.log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
    }
  }

  /**
   * Libera lock e limpa estado de execução
   * @private
   */
  async _cleanupExecutionState(task) {
    try {
      // Usar lockService.releaseLock() em vez da rota depreciada
      await this.lockService.releaseLock();
      await this.log(`🔓 Tarefa "${task.title}" desmarcada após erro (isExecuting: false)`);
    } catch (cleanupError) {
      await this.log(`❌ Erro ao limpar estado de execução: ${cleanupError.message}`);
      // Fallback: tentar a rota depreciada
      try {
        const apiUrl = this.config.API_URL;
        await this.axios.put(`${apiUrl}/api/tasks/${task.id}/finish-execution`);
        await this.log(`⚠️ Usando fallback para finish-execution`);
      } catch (fallbackError) {
        await this.log(`❌ Fallback também falhou: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} task - Tarefa que falhou
   * @param {Error} error - Erro que ocorreu
   * @param {string} userId - ID do usuário (opcional)
   * @returns {Promise<Object>} Resultado da operação
   */
  static async handleFailure(task, error, userId = null) {
    const step = new TaskFailureStep();
    const result = await step.execute({ task, error, userId });
    return result.failureResult;
  }
}

module.exports = TaskFailureStep;