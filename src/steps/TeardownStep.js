/**
 * Step responsável por finalizar a execução da tarefa, salvar logs e conteúdos
 * gerados no banco de dados e consolidar o resultado final.
 */

const container = require('../container');

class TeardownStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    // Inicialização segura das dependências
    this.log = options.log || container.resolve('log');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    this.path = options.path || container.resolve('path');
    this.taskExecutionService = options.taskExecutionService || container.resolve('taskExecutionService');
    this.taskService = options.taskService || container.resolve('taskService');
    this.fileUtils = options.fileUtils || container.resolve('fileUtils');
  }

  /**
   * Executa o step de finalização (teardown)
   */
  async execute(context) {
    const { 
      task, 
      executionLogData,
      files,
      config,
      architectPlan
    } = context;
    let { contractResult } = context;

    // Validação de segurança
    if (!contractResult) {
      await this.log('❌ TeardownStep: contractResult é undefined!');
      contractResult = { contractFulfilled: false, executionNotes: 'Erro: contractResult não definido' };
    }
    
    const finalResult = { 
      success: contractResult.contractFulfilled, 
      executionNotes: contractResult.executionNotes || (contractResult.contractFulfilled ? 'Sucesso' : 'Falha na execução')
    };

    try {
      await this.log(`🔧 [Teardown] Finalizando tarefa ${task.id}...`);

      // 1. Finaliza o log de execução no banco (se existir)
      if (executionLogData && executionLogData.id) {
        const fullExecutionLog = {
          id: executionLogData.id,
          taskId: executionLogData.taskId,
          userId: executionLogData.userId,
          model: executionLogData.model,
          startedAt: executionLogData.startedAt,
          finishedAt: new Date(),
          durationMs: Date.now() - (executionLogData.startedAt?.getTime() || Date.now()),
          success: finalResult.success,
          exitCode: finalResult.success ? 0 : 1,
          errorMessage: finalResult.success ? null : finalResult.executionNotes,
          executionNotes: finalResult.executionNotes
        };

        await this.taskExecutionService.finishExecutionLog(fullExecutionLog.id, fullExecutionLog);
        await this.log(`💾 [Teardown] Log de execução ${executionLogData.id} finalizado.`);
      }

      // 2. Salvar conteúdos dos arquivos gerados no banco de dados
      const updateData = {};
      
      const readFileSafe = async (filePath) => {
        try {
          if (filePath && await this.fileUtils.fileExists(filePath)) {
            const content = await this.fileSystem.readFile(filePath, 'utf8');
            await this.log(`📄 [Teardown] LIDO: ${this.path.basename(filePath)} (${content.length} chars)`);
            return content;
          }
        } catch (error) {
          await this.log(`❌ [Teardown] ERRO ao ler ${this.path.basename(filePath || 'unknown')}: ${error.message}`);
        }
        return null;
      };
      
      const tasksDir = config?.TASKS_DIR || './tasks';
      const architectPromptFile = this.path.join(tasksDir, `architect-prompt-${task.id}.txt`);
      
      updateData.arquitetosPromptContent = await readFileSafe(architectPromptFile);
      if (!updateData.arquitetosPromptContent) {
        updateData.arquitetosPromptContent = await readFileSafe(files?.promptFile);
      }
      
      updateData.arquitetosAnalysisContent = await readFileSafe(files?.architectPlanFile) || architectPlan || null;
      updateData.arquitetosTerminalContent = await readFileSafe(files?.architectLogFile);
      updateData.programadorTerminalContent = await readFileSafe(files?.terminalLogFile);
      updateData.programadorReportContent = await readFileSafe(files?.relatorioFile);
      
      const finalUpdateData = Object.fromEntries(Object.entries(updateData).filter(([_, v]) => v !== null));
      
      if (Object.keys(finalUpdateData).length > 0 && task?.id) {
        await this.log(`💾 [Teardown] ATUALIZANDO tarefa ${task.id} com ${Object.keys(finalUpdateData).length} campos...`);
        await this.taskService.updateTask(task.id, finalUpdateData);
        await this.log(`✅ [Teardown] Tarefa ${task.id} atualizada com sucesso.`);
      }
      
      return { ...context, finalResult };
      
    } catch (stepError) {
      await this.log(`💥 Erro no TeardownStep para tarefa ${task?.id}: ${stepError.message}`);
      return {
        ...context,
        finalResult: { success: false, executionNotes: `Falha no teardown: ${stepError.message}` },
        shouldAbort: true,
        abortReason: `Falha no teardown: ${stepError.message}`
      };
    }
  }

  static async finalizeTask(context) {
    const step = new TeardownStep();
    const result = await step.execute(context);
    return result.finalResult;
  }
}

module.exports = TeardownStep;