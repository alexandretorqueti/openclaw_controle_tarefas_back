// Versão DEBUG do DeveloperTurnStep que loga erros

const container = require('./src/container');

class DeveloperTurnStepDebug {
  constructor(options = {}) {
    this.log = options.log || container.resolve('log');
    
    this.openClawService = options.openClawService || container.resolve('openClawService');
    this.evidenceService = options.evidenceService || container.resolve('evidenceService');
    this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    this.path = options.path || container.resolve('path');
    this.taskAnalysisService = options.taskAnalysisService || container.resolve('taskAnalysisService');
  }

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
      executionTimestamp
    } = context;
    
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ DeveloperTurnStep: contexto incompleto`);
      return { ...context, turnResult: { success: false, error: 'contexto incompleto' } };
    }

    try {
      console.log('DEBUG: Início do execute');
      await this.log(`🤖 Turno ${turnNumber} para tarefa ${task.id}...`);

      // 1. GERAÇÃO DA SESSÃO PERSISTENTE
      const SessionChainUtils = require('./utils/sessionChainUtils');
      const ts = executionTimestamp || new Date().getTime();
      const turnSessionId = SessionChainUtils.generateLoopSessionId(
        task.id, 
        'programador-main-loop', 
        ts
      );
      
      await this.log(`🔗 Sessão do loop: ${turnSessionId}`);

      // 2. MONTAGEM DO PROMPT
      let promptDesteTurno = (turnNumber === 1) ? basePrompt : ""; 
      if (lastFeedback) {
        promptDesteTurno += `\n\n=== RESULTADO DA SUA ÚLTIMA AÇÃO ===\n${lastFeedback}\n\nContinue a tarefa.`;
      }

      console.log('DEBUG: Antes de writeFile');
      const developerPromptFile = this.path.join(TASKS_DIR, `developer-prompt-${task.id}-turn-${turnNumber}.txt`);
      await this.fileSystem.writeFile(developerPromptFile, promptDesteTurno).catch(() => {});

      // 3. EXECUÇÃO VIA OPENCLAW
      console.log('DEBUG: Antes de executeWithFallback');
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
      
      console.log('DEBUG: Depois de executeWithFallback, res:', res);
      
      // 4. EVIDÊNCIAS
      console.log('DEBUG: Antes de createEmptyEvidence');
      const evidence = this.evidenceService.createEmptyEvidence();
      console.log('DEBUG: evidence criada:', evidence);
      
      console.log('DEBUG: Antes de applyExecutionEvidence');
      this.evidenceService.applyExecutionEvidence(evidence, res.toolCall || {}, res.toolResult || {}, { 
        executionDirectory: project?.pastaBase || TASKS_DIR 
      });
      
      // 5. VERIFICAÇÃO DE .DONE (Rogue File)
      console.log('DEBUG: Antes de verificação .done');
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

      // 6. ANÁLISE DO RESULTADO
      console.log('DEBUG: Antes de analyzeArchitectResponse');
      const analysis = await this.taskAnalysisService.analyzeArchitectResponse(
        res.rawOutput || '', 
        task, 
        project,
        { doneExists, actualDonePath }
      );
      
      console.log('DEBUG: analysis:', analysis);

      // 7. FEEDBACK PARA O PRÓXIMO TURNO
      let feedbackForNextTurn = null;
      let hasMeaningfulProgress = true;

      // 1. Jarbas criou um .done (ou encontrou um existente)
      if (doneExists) {
          feedbackForNextTurn = `[SISTEMA] Arquivo .done encontrado em ${actualDonePath}. A tarefa está concluída.`;
          hasMeaningfulProgress = true;
      }
      // 2. Jarbas não fez nada útil
      else if (analysis.isMeaningless) {
          feedbackForNextTurn = `[SISTEMA] Sua resposta não contém ações concretas. Por favor, execute ferramentas JSON para modificar o código.`;
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

      console.log('DEBUG: Retornando resultado final');
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
      console.error('DEBUG: ERRO NO CATCH:', stepError.message);
      console.error('DEBUG: STACK:', stepError.stack);
      // ... erro handling
      throw stepError; // Re-lançar para ver o erro
    }
  }
}

module.exports = DeveloperTurnStepDebug;