// src/steps/AnalystStep.ts
/**
 * Step responsável por analisar e decompor tarefas complexas usando OpenClaw.
 * Implementa o padrão Pipeline Step com injeção via container para testabilidade.
 */

import container from '../container';
import * as path from 'path'; // Substituído o require() por import nativo do TS

class AnalystStep {
  // 1. Declaração explícita de todas as dependências do container
  private openClawService: any;
  private promptFactory: any;
  private sessionChainUtils: any;
  private jsonUtils: any;
  private taskService: any;
  private decompositionService: any;
  private commentService: any;
  private log: any;
  private config: any;
  private fileSystem: any;

  /**
   * Construtor que obtém todas as dependências do container.
   */
  constructor() {
    this.openClawService = container.get('openClawService');
    this.promptFactory = container.get('promptFactory');
    this.sessionChainUtils = container.get('sessionChainUtils');
    this.jsonUtils = container.get('jsonUtils');
    this.taskService = container.get('taskService');
    this.decompositionService = container.get('decompositionService');
    this.commentService = container.get('commentService');
    this.log = container.get('log');
    this.config = container.get('config');
    this.fileSystem = container.get('fileSystem');
  }

  /**
   * Executa o step de análise para uma tarefa
   */
  async execute(context: any): Promise<any> {
    const { task } = context;
    
    try {
      await this.log(`🔍 Chamando Arquiteto (OpenClaw) para decompor tarefa ${task.id}: ${task.title}`);

      // Usar sessão unificada baseada na cadeia de dependências
      const architectSessionId = await this.sessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
      
      await this.log(`🔗 Sessão do arquiteto (decomposição): ${architectSessionId}`);
      const architectLogFile = path.join(this.config.TASKS_DIR, `architect-${task.id}.log`);

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
      let subtasksPlan: any[] = [];
      try {
        const jsonMatch = architectResult.rawOutput.match(/\[[\s\S]*?\]/);
        if (!jsonMatch) throw new Error("Nenhum array JSON encontrado na saída do agente.");
        
        // BUG CORRIGIDO: Agora ele faz o parse apenas do JSON extraído, e não do rawOutput inteiro
        subtasksPlan = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        try {
          // Tenta de novo com a função extractJson
          const extracted = this.jsonUtils.extractJsonObjects(architectResult.rawOutput);
          subtasksPlan = Array.isArray(extracted) ? extracted : [extracted];
        } catch (extractError: any) {
          throw new Error(`Falha ao extrair o JSON da saída do OpenClaw: ${extractError.message}`);
        }
      }

      // Verifica se subtasksPlan é um array de arrays (acontece às vezes com IA)
      if (Array.isArray(subtasksPlan) && subtasksPlan.length > 0 && Array.isArray(subtasksPlan[0])) {
        subtasksPlan = subtasksPlan[0];
      }

      if (!Array.isArray(subtasksPlan) || subtasksPlan.length <= 1) {
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

      const mappedSubtasks = subtasksPlan.map((st: any) => ({
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
      
    } catch (error: any) {
      await this.log(`💥 Erro ao chamar Arquiteto para tarefa ${task.id}: ${error.message}`);
      await this._addComment(task.id, `❌ **Erro na Análise**\nFalha ao decompor tarefa: ${error.message}`, context.userId);
      
      return {
        ...context,
        analysisResult: {
          success: false,
          error: error.message
        },
        shouldAbort: true,
        abortReason: `Falha na análise: ${error.message}`
      };
    }
  }

  /**
   * Adiciona um comentário a uma tarefa (Método Tipado Corretamente)
   */
  private async _addComment(taskId: string, content: string, userId: string | null = null): Promise<void> {
    try {
      await this.commentService.createComment({
        taskId,
        userId,
        content
      });
    } catch (error: any) {
      await this.log(`⚠️ Erro ao adicionar comentário: ${error.message}`);
    }
  }
}

export default AnalystStep;