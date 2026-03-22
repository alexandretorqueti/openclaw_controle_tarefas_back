// src/steps/TaskSuccessStep.ts
/**
 * Step responsável por tratar sucesso na execução de tarefas.
 * Inclui logging, finalização na API, movimentação de arquivos e liberação de lock.
 */

import container from '../container';

class TaskSuccessStep {
  // 1. Declaração explícita de todas as dependências
  private log: any;
  private config: any;
  private axios: any;
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
   * Executa o step de tratamento de sucesso
   */
  async execute(context: any): Promise<any> {
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
        } catch (apiError: any) {
          await this.log(`❌ Erro ao finalizar a tarefa na API: ${apiError.message}`);
          // Não falha o step inteiro, apenas loga o erro
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
      } catch (lockError: any) {
        await this.log(`⚠️ Erro ao liberar lock: ${lockError.message}`);
        // Não falha o step inteiro, apenas loga o erro
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
      
    } catch (stepError: any) {
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
   */
  static async handleSuccess(task: any, executionResult: any, userId: string | null = null): Promise<any> {
    const step = new TaskSuccessStep();
    const result = await step.execute({ task, executionResult, userId });
    return result.successResult;
  }
}

export default TaskSuccessStep;