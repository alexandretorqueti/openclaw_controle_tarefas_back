
// src/steps/DeveloperTurnStep.js
/**
 * Step responsável por executar um turno individual do desenvolvedor.
 * Inclui geração de sessão, execução via OpenClaw e coleta básica de evidências.
 */

const container = require('../container');

class DeveloperTurnStep {
  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    
    // Usar instâncias fornecidas ou criar do container
    this.openClawService = options.openClawService || container.resolve('openClawService');
    this.evidenceService = options.evidenceService || container.resolve('evidenceService');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    this.path = options.path || container.resolve('path');
    this.sessionChainUtils = options.sessionChainUtils || container.resolve('sessionChainUtils');
    this.workspaceSnapshotService = options.workspaceSnapshotService || container.resolve('workspaceSnapshotService');

    // ADICIONE ESTA LINHA:
    this.taskAnalysisService = options.taskAnalysisService || container.resolve('taskAnalysisService');
  }

  /**
   * Executa um turno do desenvolvedor
   * @param {Object} context - Contexto do pipeline
   * @param {Object} context.task - Tarefa
   * @param {Object} context.project - Projeto (pode ser null)
   * @param {Object} context.files - Arquivos preparados
   * @param {Object} context.config - Configuração
   * @param {number} context.turnNumber - Número do turno (1-indexed)
   * @param {string} context.basePrompt - Prompt base (inclui contexto de dependências)
   * @param {string} context.lastFeedback - Feedback do turno anterior (pode ser null)
   * @param {string} context.backupAgent - Agente de fallback
   * @returns {Promise<Object>} Contexto atualizado com resultado do turno
   */
  async execute(context) {
    const { 
      task, 
      project, 
      files, 
      config, 
      turnNumber = 1,
      basePrompt = '',
      lastFeedback = null,
      backupAgent = 'main',
      initialSnapshot,
      executionTimestamp // Certifique-se que o Orchestrator passa isso
    } = context;
    if (!task || !files || !config) {
      await this.log(`⚠️ DeveloperTurnStep: contexto incompleto`);
      return { ...context, turnResult: { success: false, error: 'contexto incompleto' } };
    }
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    try {
      await this.log(`🤖 Turno ${turnNumber} para tarefa ${task.id}...`);

      // 1. GERAÇÃO DA SESSÃO PERSISTENTE (Corrigido para usar o Loop ID)

      const ts = executionTimestamp || new Date().getTime();
      const turnSessionId = this.sessionChainUtils.generateLoopSessionId(
        task.id, 
        'programador-main-loop', 
        ts
      );
      
      await this.log(`🔗 Sessão do loop: ${turnSessionId}`);

      // 2. MONTAGEM DO PROMPT
      // Se não for o primeiro turno e estivermos na mesma sessão, 
      // podemos mandar apenas o feedback para economizar contexto.
      let promptDesteTurno = (turnNumber === 1) ? basePrompt : ""; 
      if (lastFeedback) {
        promptDesteTurno += `\n\n=== RESULTADO DA SUA ÚLTIMA AÇÃO ===\n${lastFeedback}\n\nContinue a tarefa.`;
      }

      const developerPromptFile = this.path.join(TASKS_DIR, `developer-prompt-${task.id}-turn-${turnNumber}.txt`);
      await this.fileSystem.writeFile(developerPromptFile, promptDesteTurno).catch(() => {});

      // 3. EXECUÇÃO VIA OPENCLAW
      const res = await this.openClawService.executeWithFallback(
        turnSessionId,
        promptDesteTurno,
        task.agent || project?.agent || 'main',
        backupAgent,
        null,
        TASKS_DIR,
        files.terminalLogFile,
        project?.pastaBase,
        TASK_TIMEOUT_MS
      );
      
      // 4. EVIDÊNCIAS
      const evidence = this.evidenceService.createEmptyEvidence();
      this.evidenceService.applyExecutionEvidence(evidence, res.toolCall || {}, res.toolResult || {}, { 
        executionDirectory: project?.pastaBase || TASKS_DIR 
      });
      
      // 5. VERIFICAÇÃO DE .DONE (Rogue File)
      let doneExists = false;
      let actualDonePath = files.doneFile;
      const findDynamicDone = async (dir) => {
        if (!dir) return null;
        try {
          const dirFiles = await this.fileSystem.readdir(dir);
          const found = dirFiles.find(f => f.endsWith('.done'));
          return found ? this.path.join(dir, found) : null;
        } catch(e) { return null; }
      };
      const rogueDoneFile = (await findDynamicDone(TASKS_DIR)) || (await findDynamicDone(project?.pastaBase));
      if (rogueDoneFile) {
        doneExists = true;
        actualDonePath = rogueDoneFile;
      }

      // 6. VERIFICA SE HOUVE ALTERAÇÃO NOS ARQUIVOS DO PROJETO
      const currentSnapshot = await this.workspaceSnapshotService.takeSnapshot(project?.pastaBase || ctx.config.TASKS_DIR);
      const changes = this.workspaceSnapshotService.compareSnapshots(initialSnapshot, currentSnapshot);
      const hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;

      // 6. DETECTA TRUNCAMENTO
      const raw = res.rawOutput || '';
      let truncatedInfo = { detected: (raw.includes('{') && !raw.includes('}')) };
      
      // 7. PREPARA FEEDBACK E ANÁLISE INTELIGENTE DO TURNO
      let feedbackForNextTurn = null;
      let hasMeaningfulProgress = true;

      // Chama a inteligência para avaliar o turno
      let analysis = {
        isDeclaringDone: true,
        hasFulfilledContract: true,
        missingRequirements: [],
        isTalkingWithoutAction: false
      }
      
      if (!doneExists && !hasRealChanges) {
        analysis = await this.taskAnalysisService.analyzeDeveloperTurn({
          rawOutput: res.rawOutput,
          task: task,
          evidence: evidence,
          doneExists: doneExists
        });
      }
      // Hierarquia de Feedbacks (quem grita mais alto)
      
      // 1. Erro Crítico de Sintaxe (Truncamento)
      if (truncatedInfo && truncatedInfo.detected) {
          feedbackForNextTurn = `[ERRO DE SINTAXE] Seu bloco JSON foi cortado. Por favor, reenvie a ferramenta completa.`;
          hasMeaningfulProgress = false;
      }
      // 2. Jarbas cantou vitória antes da hora
      else if (analysis.isDeclaringDone && !analysis.hasFulfilledContract) {
          feedbackForNextTurn = `[SISTEMA] Você indicou que terminou, mas minha análise detectou pendências:
${analysis.missingRequirements.map(req => `- ${req}`).join('\n')}

Por favor, complete o que falta na mesma sessão. Se faltar o .done na pasta ${TASKS_DIR}, use a ferramenta 'exec' com 'touch .done'.`;
          hasMeaningfulProgress = false;
      } 
      // 3. Jarbas só pensou, não agiu
      else if (analysis.isTalkingWithoutAction) {
          feedbackForNextTurn = `[SISTEMA] Você explicou um plano, mas não executou nenhuma ferramenta JSON. Por favor, aplique as mudanças agora.`;
          hasMeaningfulProgress = false;
      }
      // 4. Fluxo Normal (A ferramenta rodou e devolveu um log/resultado)
      else if (res.toolFeedback) {
          feedbackForNextTurn = res.toolFeedback;
      }

      return {
        ...context,
        turnResult: {
          success: true,
          turnNumber,
          sessionId: turnSessionId,
          openClawResult: res,
          evidence,
          doneExists,
          actualDonePath,
          hasMeaningfulProgress,
          feedbackForNextTurn,
          lastFeedback: feedbackForNextTurn
        },
        evidence,
        currentOpenClawResult: res,
        doneFileExists: doneExists,
        actualDoneFilePath: actualDonePath
      };
      
    } catch (stepError) {
      // Log detalhado do erro para debug
      console.error('\n🔍🔍🔍 ERRO DETALHADO NO DeveloperTurnStep 🔍🔍🔍');
      console.error('Mensagem:', stepError.message);
      console.error('Tipo:', typeof stepError);
      console.error('Construtor:', stepError.constructor?.name);
      console.error('Stack:', stepError.stack);
      console.error('Propriedades:', Object.getOwnPropertyNames(stepError));
      console.error('🔍🔍🔍 FIM DO ERRO DETALHADO 🔍🔍🔍\n');
      
      await this.log(`💥 Erro no DeveloperTurnStep para tarefa ${task?.id || 'unknown'}: ${stepError.message}`);
      return {
        ...context,
        turnResult: {
          success: false,
          error: stepError.message,
          turnNumber: turnNumber || 1,
          sessionId: 'error-session',
          errorType: stepError.constructor?.name,
          hasStack: !!stepError.stack
        }
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {Object} context - Contexto completo
   * @returns {Promise<Object>} Resultado do turno
   */
  static async executeTurn(context) {
    const step = new DeveloperTurnStep();
    const result = await step.execute(context);
    return result.turnResult;
  }
}

module.exports = DeveloperTurnStep;


