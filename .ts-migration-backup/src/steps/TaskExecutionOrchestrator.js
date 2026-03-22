// src/steps/TaskExecutionOrchestrator.js
/**
 * Orchestrator principal que executa uma tarefa completa usando o pipeline de steps.
 * Substitui o método `executeTask` do TaskExecutionService.
 */

const container = require('../container');

class TaskExecutionOrchestrator {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.get('log');
  }

  /**
   * Executa uma tarefa completa usando o pipeline de steps
   * @param {Object} task - Tarefa a ser executada
   * @param {string} userId - ID do usuário
   * @param {Object} config - Configuração do sistema
   * @returns {Promise<Object>} Resultado da execução
   */
  async executeTask(task, userId, config) {
    const initialContext = { task, userId, config };

    try {
      await this.log(`🚀 [Orchestrator] Iniciando execução da tarefa ${task.id}: "${task.title}"`);

      // 1. SETUP CONTEXT
      await this.log(`🔧 [Orchestrator] Executando SetupContextStep...`);
      const SetupContextStep = require('./SetupContextStep');
      const setupStep = new SetupContextStep();
      const setupResult = await setupStep.execute(initialContext);
      
      if (setupResult.shouldAbort) {
        await this.log(`⏹️ [Orchestrator] Setup abortado: ${setupResult.abortReason}`);
        return {
          success: false,
          executionNotes: `Setup abortado: ${setupResult.abortReason}`,
          taskId: task.id
        };
      }

      // 2. ARCHITECT PLANNING
      await this.log(`🏗️ [Orchestrator] Executando ArchitectPlanningStep...`);
      const ArchitectPlanningStep = require('./ArchitectPlanningStep');
      const architectStep = new ArchitectPlanningStep();
      const architectResult = await architectStep.execute(setupResult);
      
      if (architectResult.shouldAbort) {
        await this.log(`⏹️ [Orchestrator] Arquitetura abortada: ${architectResult.abortReason}`);
        return {
          success: false,
          executionNotes: `Arquitetura abortada: ${architectResult.abortReason}`,
          taskId: task.id
        };
      }

      // 3. DEVELOPER LOOP
      await this.log(`🔄 [Orchestrator] Executando DeveloperLoopOrchestrator...`);
      const DeveloperLoopOrchestrator = require('./DeveloperLoopOrchestrator');
      const developerOrchestrator = new DeveloperLoopOrchestrator();
      const developerResult = await developerOrchestrator.execute(architectResult);
      
      if (developerResult.shouldAbort) {
        await this.log(`⏹️ [Orchestrator] Loop do desenvolvedor abortado: ${developerResult.abortReason}`);
        return {
          success: false,
          executionNotes: `Loop do desenvolvedor abortado: ${developerResult.abortReason}`,
          taskId: task.id
        };
      }

      // 4. TEARDOWN
      await this.log(`🔧 [Orchestrator] Executando TeardownStep...`);
      const TeardownStep = require('./TeardownStep');
      const teardownStep = new TeardownStep();
      const teardownResult = await teardownStep.execute({
        ...developerResult,
        contractResult: developerResult.contractResult || { contractFulfilled: false }
      });
      
      if (teardownResult.shouldAbort) {
        await this.log(`⏹️ [Orchestrator] Teardown abortado: ${teardownResult.abortReason}`);
        return {
          success: false,
          executionNotes: `Teardown abortado: ${teardownResult.abortReason}`,
          taskId: task.id
        };
      }

      // 5. RESULTADO FINAL
      const finalResult = teardownResult.finalResult || {
        success: false,
        executionNotes: 'Resultado final não definido'
      };
      
      await this.log(`✅ [Orchestrator] Tarefa ${task.id} concluída: ${finalResult.success ? 'SUCESSO' : 'FALHA'}`);
      
      return {
        success: finalResult.success,
        executionNotes: finalResult.executionNotes,
        taskId: task.id
      };

    } catch (error) {
      await this.log(`💥 [FATAL Orchestrator] O pipeline falhou: ${error.message}\n${error.stack}`);
      
      return {
        success: false,
        executionNotes: `Falha crítica no pipeline: ${error.message}`,
        taskId: task.id
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} task - Tarefa a ser executada
   * @param {string} userId - ID do usuário
   * @param {Object} config - Configuração do sistema
   * @returns {Promise<Object>} Resultado da execução
   */
  static async execute(task, userId, config) {
    const orchestrator = new TaskExecutionOrchestrator();
    return await orchestrator.executeTask(task, userId, config);
  }
}

module.exports = TaskExecutionOrchestrator;