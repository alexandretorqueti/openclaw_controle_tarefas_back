// src/steps/ArchitectPlanningStep.js
/**
 * Step responsável pela análise e planejamento do arquiteto.
 * O arquiteto analisa a tarefa, gera um plano de ação e pode até executar a tarefa.
 * Inclui validação inteligente de evidências e decisão de fluxo.
 */

const container = require('../container');

class ArchitectPlanningStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = container.get('log');
    
    // Usar instâncias fornecidas ou criar do container
    this.openClawService = options.openClawService || container.get('openClawService');
    this.sessionChainUtils = options.sessionChainUtils || container.get('sessionChainUtils');
    this.smartFileFinder = options.smartFileFinder || container.get('smartFileFinder');
    this.taskAnalysisService = options.taskAnalysisService || container.get('taskAnalysisService');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.get('workspaceSnapshotService');
    this.fileUtils = options.fileUtils || container.get('fileUtils');
    this.fileSystem = options.fileSystem || container.get('fileSystem');
    this.promptFactory = options.promptFactory || container.get('promptFactory');
  }

  /**
   * Executa o step de planejamento do arquiteto
   * @param {Object} context - Contexto do pipeline (deve conter dados do SetupContextStep)
   * @param {Object} context.task - Tarefa
   * @param {Object} context.project - Projeto (pode ser null)
   * @param {Object} context.files - Arquivos preparados
   * @param {Map} context.initialSnapshot - Snapshot inicial
   * @param {Object} context.config - Configuração
   * @param {Object} context.analysisPlan - Plano de análise
   * @param {string} context.commentsSection - Seção de comentários
   * @param {string} context.developerPrompt - Prompt do desenvolvedor
   * @param {string} context.currentInput - Prompt atual
   * @returns {Promise<Object>} Contexto atualizado com análise do arquiteto
   */
  async execute(context) {
    const { 
      task, 
      project, 
      files, 
      initialSnapshot, 
      config, 
      analysisPlan, 
      commentsSection = '', 
      developerPrompt = '',
      currentInput = ''
    } = context;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ ArchitectPlanningStep: contexto incompleto`);
      return {
        ...context,
        architectPlanningResult: {
          success: false,
          error: 'contexto incompleto (task, files ou config faltando)'
        }
      };
    }

    try {
      await this.log(`📋 [Arquiteto] Tipo de tarefa: ${analysisPlan.taskType}`);
      
      const fileList = Array.from(initialSnapshot.keys());
      const architectInput = this.promptFactory.buildArchitectPrompt(
        task, 
        project, 
        fileList, 
        files.architectPlanFile, 
        commentsSection, 
        analysisPlan.taskType
      );
      
      await this.log(`🧠 [Arquiteto] Avaliando a tarefa ${task.id} e montando o plano de ação...`);
      
      // Gera um ID de sessão unificado baseado na primeira tarefa da cadeia de dependências
      const architectSessionId = await this.sessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
      
      await this.log(`🔗 Sessão do arquiteto: ${architectSessionId} (baseada na cadeia de dependências)`);
      
      // Roda o Arquiteto com timeout de 10 minutos (600000ms)
      const architectResult = await this.openClawService.executeWithFallback(
        architectSessionId,
        architectInput,
        project?.agent || task.agent || 'main',
        task.agent || 'main',
        null,
        config.TASKS_DIR,
        files.architectLogFile,
        project?.pastaBase,
        config.TASK_TIMEOUT_MS
      );
      
      let architectPlan = "";
      let architectAnalysis = null;
      
      // Busca inteligente pelo plano do arquiteto
      const planSearch = await this.smartFileFinder.findRealArchitectPlan(
        files.architectPlanFile, 
        config.TASKS_DIR, 
        5
      );
      
      if (planSearch.content) {
        architectPlan = planSearch.content;
        await this.log(`📝 [Arquiteto] Plano recuperado com sucesso (${architectPlan.length} caracteres).`);
      } else if (architectResult.rawOutput && architectResult.rawOutput.trim().length > 50) {
        // Fallback: Se não salvou em arquivo nenhum, tenta usar rawOutput do terminal
        architectPlan = architectResult.rawOutput;
        await this.log(`📝 [Arquiteto] Arquivo não encontrado. Usando rawOutput do terminal como fallback (${architectPlan.length} chars)`);
        // Força a gravação no arquivo correto
        await this.fileSystem.writeFile(files.architectPlanFile, architectPlan).catch(() => {});
      }

      // Verificar se temos um plano do arquiteto
      if (architectPlan && architectPlan.trim().length > 0) {
        // 1. ANÁLISE INTELIGENTE DA RESPOSTA DO ARQUITETO
        await this.log(`🧠 [Arquiteto] Analisando resposta com IA...`);
        const existsDoneFile = await this.fileUtils.fileExists(files.doneFile);
        
        architectAnalysis = await this.taskAnalysisService.analyzeArchitectResponse(architectPlan, task, project);
        
        await this.log(`📊 [Arquiteto] Análise inicial: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
        
        const hadExecuted = architectAnalysis.hadExecuted;
        
        // VALIDAÇÃO CRÍTICA: Se a IA diz que executou, verificar evidências reais
        if ((architectAnalysis.hasExecuted && architectAnalysis.confidence > 70) || existsDoneFile) {
          await this.log(`🔍 [Validação] IA diz que arquiteto executou. Verificando evidências...`);
          
          // Verificar se há evidências reais de execução
          const currentSnapshot = await this.workspaceSnapshotService.takeSnapshot(
            project?.pastaBase || config.TASKS_DIR
          );
          
          const changes = this.workspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
          const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
          const architectDoneExists = await this.fileUtils.fileExists(files.doneFile);
          const architectReportExists = await this.fileUtils.fileExists(files.relatorioFile);
          
          // Para tarefas de análise, evidência pode ser apenas relatório/.done (não precisa de alterações)
          const hasEvidence = architectDoneExists || architectReportExists || 
                             (analysisPlan.taskType === 'analysis' ? true : (hasRealChanges || hadExecuted));
          
          if (!hasEvidence) {
            await this.log(`⚠️ [Validação] NENHUMA evidência encontrada! IA provavelmente errou. Corrigindo análise...`);
            // Corrigir a análise: não executou, apenas planejou
            architectAnalysis = {
              hasExecuted: false,
              hasPlan: true,
              confidence: 80,
              executionDetails: null,
              planDetails: "Arquiteto gerou plano detalhado, mas não executou alterações (validação de evidências falhou)",
              analysisFailed: false
            };
            await this.log(`📊 [Arquiteto] Análise CORRIGIDA: hasExecuted=false, hasPlan=true (falta de evidências)`);
          } else {
            if (analysisPlan.taskType === 'analysis') {
              await this.log(`✅ [Validação] Evidências confirmadas para análise: relatório/.done criados`);
            } else {
              await this.log(`✅ [Validação] Evidências confirmadas: ${changes.modified.length} arquivos modificados, ${changes.created.length} criados`);
            }
          }
        }
        
        if (architectAnalysis.hasExecuted) {
          await this.log(`✅ [Arquiteto] Análise indica que já executou a tarefa (${architectAnalysis.confidence}% confiança).`);
          if (architectAnalysis.executionDetails) {
            await this.log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.executionDetails.substring(0, 100)}...`);
          }
        } else if (architectAnalysis.hasPlan) {
          await this.log(`📋 [Arquiteto] Análise indica que gerou plano de ação (${architectAnalysis.confidence}% confiança).`);
          if (architectAnalysis.planDetails) {
            await this.log(`📝 [Arquiteto] Detalhes: ${architectAnalysis.planDetails.substring(0, 100)}...`);
          }
        } else if (architectAnalysis.analysisFailed) {
          await this.log(`⚠️ [Arquiteto] Análise falhou ou resposta incompreensível.`);
        } else {
          await this.log(`ℹ️ [Arquiteto] Análise não identificou execução nem plano claro.`);
        }
      } else {
        architectPlan = "O arquiteto não conseguiu gerar um plano detalhado. Siga a descrição original da tarefa.";
        architectAnalysis = {
          hasExecuted: false,
          hasPlan: false,
          confidence: 0,
          executionDetails: null,
          planDetails: null,
          analysisFailed: true
        };
        await this.log(`⚠️ [Arquiteto] Resposta vazia ou inválida. Usando descrição original.`);
      }

      // 2. DECIDIR FLUXO COM BASE NA ANÁLISE INTELIGENTE
      let updatedPromptContent;
      
      if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
        // Arquiteto já executou com alta confiança (E PASSOU NA VALIDAÇÃO) - usar APENAS a análise do arquiteto
        updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
        await this.log(`🔄 [Arquiteto] Fluxo: Usando execução do arquiteto (alta confiança + evidências validadas).`);
      } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
        // Arquiteto gerou plano - SUBSTITUIR pelo plano + adicionar instruções do desenvolvedor
        updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===\n${architectPlan}\n\n${developerPrompt}`;
        await this.log(`🔄 [Arquiteto] Fluxo: Substituindo prompt pelo plano + instruções do desenvolvedor.`);
      } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
        // Arquiteto falhou - manter original
        updatedPromptContent = currentInput;
        await this.log(`🔄 [Arquiteto] Fluxo: Mantendo prompt original (análise falhou).`);
      } else {
        // Caso padrão (baixa confiança, resposta ambígua)
        updatedPromptContent = `${currentInput}\n\n=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\nAnalise a resposta acima e execute conforme necessário.`;
        await this.log(`🔄 [Arquiteto] Fluxo: Resposta ambígua, incluindo análise como referência.`);
      }
      
      await this.fileSystem.writeFile(files.promptFile, updatedPromptContent);
      
      await this.log(`✅ [Arquiteto] Planejamento concluído para tarefa ${task.id}`);
      
      return {
        ...context,
        architectPlanningResult: {
          success: true,
          taskId: task.id,
          hasArchitectPlan: !!architectPlan.trim(),
          hasArchitectExecution: architectAnalysis.hasExecuted,
          confidence: architectAnalysis.confidence,
          promptUpdated: true
        },
        currentInput: updatedPromptContent,
        architectAnalysis,
        architectPlan
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no ArchitectPlanningStep para tarefa ${task.id}: ${stepError.message}`);
      
      return {
        ...context,
        architectPlanningResult: {
          success: false,
          error: stepError.message,
          taskId: task.id
        },
        shouldAbort: true,
        abortReason: `Falha no planejamento do arquiteto: ${stepError.message}`
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} context - Contexto completo (deve conter todos os dados necessários)
   * @returns {Promise<Object>} Resultado do planejamento
   */
  static async planArchitect(context) {
    const step = new ArchitectPlanningStep();
    const result = await step.execute(context);
    return result.architectPlanningResult;
  }
}

module.exports = ArchitectPlanningStep;