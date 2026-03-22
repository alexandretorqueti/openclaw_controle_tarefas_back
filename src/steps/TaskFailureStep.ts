// src/steps/TaskFailureStep.ts
/**
 * Step responsável por tratar falhas na execução de tarefas.
 * Inclui logging, comentários, reatribuição, limpeza de locks e movimentação de arquivos.
 */

import container from '../container';

class TaskFailureStep {
  // 1. Declaração explícita de todas as dependências
  private log: any;
  private config: any;
  private axios: any;
  private path: any;
  private fileUtils: any;
  private fileSystem: any;
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
    this.axios = container.get('axios');
    this.path = container.get('path');
    this.fileUtils = container.get('fileUtils');
    this.fileSystem = container.get('fileSystem');
    
    // Usar instâncias fornecidas ou criar do container
    this.lockService = options.lockService || this._createLockService();
    this.stateService = options.stateService || this._createStateService();
    this.taskFileService = options.taskFileService || this._createTaskFileService();
  }

  /**
   * Cria instância do LockService com configuração
   */
  private _createLockService(): any {
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
   * Executa o step de tratamento de falha
   */
  async execute(context: any): Promise<any> {
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

      // 2. Adicionar comentário sobre a falha se tivermos userId
      if (userId) {
        try {
          await this.axios.post(`${apiUrl}/api/comments`, {
            taskId: task.id,
            userId,
            content: `⚠️ **FALHA DE EXECUÇÃO LOCAL**\nErro: ${error.message}\n\nSaída do Terminal:\n${terminalOutput.substring(0, 1000)}`
          });
        } catch (commentError: any) {
          await this.log(`❌ Erro ao postar comentário de falha: ${commentError.message}`);
        }
      }
      
      // 3. Tentar reatribuir para o desenvolvedor 'alexandre'
      await this._tryReassignTask(task, apiUrl);
      
      // 4. Liberar lock e limpar estado de execução
      await this._cleanupExecutionState(task);
      
      // 5. Mover arquivos para pasta de erro
      await this.taskFileService.moveTaskFiles(task.id, TASKS_DIR, ERROR_DIR);
      
      // 6. Limpar estado interno
      await this.stateService.cleanupTask(task.id);
      
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
      
    } catch (stepError: any) {
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
   */
  private async _tryReassignTask(task: any, apiUrl: string): Promise<any> {
    try {
      const usersRes = await this.axios.get(`${apiUrl}/api/users`);
      const dev = (usersRes.data.users || []).find((u: any) => u.nickname === 'alexandre');
      
      if (dev) {
        await this.log(`👤 Reatribuindo tarefa ${task.id} para o usuário alexandre.`);
        await this.axios.put(`${apiUrl}/api/tasks/${task.id}`, { assignedToId: dev.id });
      } else {
        await this.log(`⚠️ Usuário 'alexandre' não encontrado na API`);
      }
    } catch (assignError: any) {
      await this.log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
    }
  }

  /**
   * Libera lock e limpa estado de execução
   */
  private async _cleanupExecutionState(task: any): Promise<any> {
    try {
      // Usar lockService.releaseLock() em vez da rota depreciada
      await this.lockService.releaseLock();
      await this.log(`🔓 Tarefa "${task.title}" desmarcada após erro (isExecuting: false)`);
    } catch (cleanupError: any) {
      await this.log(`❌ Erro ao limpar estado de execução: ${cleanupError.message}`);
      // Fallback: tentar a rota depreciada
      try {
        const apiUrl = this.config.API_URL;
        await this.axios.put(`${apiUrl}/api/tasks/${task.id}/finish-execution`);
        await this.log(`⚠️ Usando fallback para finish-execution`);
      } catch (fallbackError: any) {
        await this.log(`❌ Fallback também falhou: ${fallbackError.message}`);
      }
    }
  }

  /**
   * Método estático de conveniência para uso direto
   */
  static async handleFailure(task: any, error: any, userId: string | null = null): Promise<any> {
    const step = new TaskFailureStep();
    const result = await step.execute({ task, error, userId });
    return result.failureResult;
  }
}

export default TaskFailureStep;