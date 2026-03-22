// Migrado para TypeScript - Fase: Steps
// Arquivo: AnalystStep.js

// src/steps/AnalystStep.js
/**
 * Step responsável por analisar e decompor tarefas complexas usando OpenClaw.
 * Implementa o padrão Pipeline Step com injeção via container para testabilidade.
 */

import container from '../container';

class AnalystStep {
  /**
   * Construtor que obtém todas as dependências do container.
   * Para testes, o container deve ser previamente configurado com mocks.
   */
  constructor() {
    (this as any).openClawService = container.resolve('openClawService');
    (this as any).promptFactory = container.resolve('promptFactory');
    (this as any).sessionChainUtils = container.resolve('sessionChainUtils');
    (this as any).jsonUtils = container.resolve('jsonUtils');
    (this as any).taskService = container.resolve('taskService');
    (this as any).decompositionService = container.resolve('decompositionService');
    (this as any).commentService = container.resolve('commentService');
    (this as any).log = container.resolve('log');
    (this as any).config = container.resolve('config');
    (this as any).fileSystem = container.resolve('fileSystem');
    
    // Dependências built-in (não injetadas por padrão, mas podem ser mockadas)
    (this as any).path = require('path');
  }

  /**
   * Executa o step de análise para uma tarefa
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa a ser analisada
   * @param {Object} context.project - Projeto relacionado (opcional)
   * @returns {Promise<Object>} Contexto atualizado com resultado da análise
   */
  async execute(context): Promise<any> {
    const { task } = context;
    
    try {
      await this.log(`🔍 Chamando Arquiteto (OpenClaw) para decompor tarefa ${task.id}: ${task.title}`);

      // Usar sessão unificada baseada na cadeia de dependências
      const architectSessionId = await this.sessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
      
      await this.log(`🔗 Sessão do arquiteto (decomposição): ${architectSessionId}`);
      const architectLogFile = this.path.join(this.config.TASKS_DIR, `architect-${task.id}.log`);

      const primaryAgent = task.project?.agent || task.project?.programadorBack || 'main';
      const fallbackAgent = task.project?.programadorFront || 'main';

      // Usando o PromptFactory de forma limpa
      const architectInput = this.promptFactory.buildDecompositionPrompt(task);

      const architectResult = await this.openClawService.executeWithFallback(
        architectSessionId,
        architectInput,
        primaryAgent,
        fallbackAgent,
        task.project?.modeloAuxiliar || null,
        this.config.TASKS_DIR,
        architectLogFile,
        task.project?.pastaBase,
        this.config.TASK_TIMEOUT_MS
      );

      if (!architectResult.success) {
        throw new Error(`Falha na execução do OpenClaw: ${architectResult.errorMessage}`);
      }

      // Extrai o JSON do rawOutput
      let subtasksPlan = [];
      try {
        const jsonMatch = architectResult.rawOutput.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) throw new Error("Nenhum array JSON encontrado na saída do agente.");
        
        subtasksPlan = JSON.parse(architectResult.rawOutput);
      } catch (parseError) {
        try {
          // Tenta de novo com a função extractJson
          subtasksPlan = this.jsonUtils.extractJsonObjects(architectResult.rawOutput);  
        } catch (extractError) {
          throw new Error(`Falha ao extrair o JSON da saída do OpenClaw: ${extractError.message}`);
        }
      }

      // Verifica se subtasksPlan é um array de objetos ou outro array.
      if (Array.isArray(subtasksPlan) && subtasksPlan.length > 0 && Array.isArray(subtasksPlan[0])) {
        subtasksPlan = subtasksPlan[0];
      }

      if (!Array.isArray(subtasksPlan) || subtasksPlan.length === 0 || subtasksPlan.length === 1) {
        // Marcar essa tarefa como atômica e seguir para o fluxo normal.
        await this.taskService.updateTask(task.id, { isAtomic: true });
        
        await this._addComment(task.id, `🔍 **Análise Concluída pelo Arquiteto**\nEsta tarefa é atômica e não requer decomposição.`, context.userId);
        await this.log(`✅ Tarefa ${task.id} validada como atômica pelo arquiteto.`);
        
        return {
          ...context,
          analysisResult: {
            success: true,
            subtasksCreated: 0,
            isAtomic: true
          }
        };
      }

      const mappedSubtasks = subtasksPlan.map(st => ({
        title: st.title,
        description: st.description,
        domain: st.domain, 
        projectId: task.projectId,
        statusId: task.statusId,
        priorityId: task.priorityId,
        userId: task.assignedToId, 
        agent: task.agent
      }));
      
      const decompositionResult = await this.decompositionService.decompose(task.id, mappedSubtasks);
      
      await this._addComment(task.id, `🔍 **Análise Concluída pelo Arquiteto**\nA funcionalidade foi dividida em ${mappedSubtasks.length} micro-tarefas sequenciais.`, context.userId);
      await this.log(`✅ Tarefa ${task.id} decomposta pelo OpenClaw em ${mappedSubtasks.length} subtarefas.`);
      
      return {
        ...context,
        analysisResult: {
          success: true,
          subtasksCreated: mappedSubtasks.length,
          subtasks: mappedSubtasks,
          decompositionResult
        }
      };
      
    } catch (error) {
      await this.log(`💥 Erro ao chamar Arquiteto para tarefa ${task.id}: ${error.message}`);
      await this._addComment(task.id, `❌ **Erro na Análise**\nFalha ao decompor tarefa: ${error.message}`, context.userId);
      
      return {
        ...context,
        analysisResult: {
          success: false,
          error: error.message
        },
        // Flag opcional para interromper pipeline
        shouldAbort: true,
        abortReason: `Falha na análise: ${error.message}`
      };
    }
  }

  /**
   * Adiciona um comentário a uma tarefa
   * @private
   */
  async _addComment(taskId, content, userId = null): Promise<any> {
    try {
      await this.commentService.createComment({
        taskId,
        userId,
        content
      });
    } catch (error) {
      await this.log(`⚠️ Erro ao adicionar comentário: ${error.message}`);
    }
  }
}

export default AnalystStep;