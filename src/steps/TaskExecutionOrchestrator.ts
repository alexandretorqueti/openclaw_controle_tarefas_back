// src/steps/TaskExecutionOrchestrator.ts
/**
 * Orchestrator principal que executa uma tarefa completa usando o pipeline de steps.
 * Substitui o método `executeTask` do TaskExecutionService.
 */

import container from '../container';

// Imports estáticos movidos para o topo (Padrão ESM/TypeScript)
import SetupContextStep from './SetupContextStep';
import ArchitectPlanningStep from './ArchitectPlanningStep';
import DeveloperLoopOrchestrator from './DeveloperLoopOrchestrator';
import TeardownStep from './TeardownStep';

class TaskExecutionOrchestrator {
  // 1. Declaração explícita da propriedade
  private log: any;

  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options: any = {}) {
    this.log = options.log || container.get('log');
  }

  /**
   * Executa uma tarefa completa usando o pipeline de steps
   */
  async executeTask(task: any, userId: string, config: any): Promise<any> {
    const initialContext = { task, userId, config };

    try {
      await this.log(`🚀 [Orchestrator] Iniciando execução da tarefa ${task.id}: "${task.title}"`);

      // 1. SETUP CONTEXT
      await this.log(`🔧 [Orchestrator] Executando SetupContextStep...`);
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

    } catch (error: any) {
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
   */
  static async execute(task: any, userId: string, config: any): Promise<any> {
    const orchestrator = new TaskExecutionOrchestrator();
    return await orchestrator.executeTask(task, userId, config);
  }
}

export default TaskExecutionOrchestrator;