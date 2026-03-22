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
      backupAgent = 'main'
    } = context;
    
    const { TASKS_DIR, TASK_TIMEOUT_MS } = config;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ DeveloperTurnStep: contexto incompleto`);
      return {
        ...context,
        turnResult: {
          success: false,
          error: 'contexto incompleto (task, files ou config faltando)'
        }
      };
    }

    try {
      await this.log(`🤖 Turno ${turnNumber} para tarefa ${task.id}...`);
      
      // 1. GERAÇÃO DA SESSÃO DO DESENVOLVEDOR (Isolada por Tarefa/Turno)
      const timestamp = new Date().getTime();
      const turnSessionId = `programador-${task.id}-${timestamp}`;
      
      await this.log(`🔗 Sessão do turno ${turnNumber}: ${turnSessionId} (isolada por tarefa/turno)`);

      // 2. MONTAGEM DO DOSSIÊ DO TURNO
      let promptDesteTurno = basePrompt;
      if (lastFeedback) {
        promptDesteTurno += `\n\n=== RESULTADO DA SUA ÚLTIMA AÇÃO ===\n${lastFeedback}\n\nContinue a tarefa com base neste feedback. Você DEVE usar uma ferramenta JSON para prosseguir.`;
      }

      // Salva o prompt do turno no disco para auditoria
      const developerPromptFile = this.path.join(TASKS_DIR, `developer-prompt-${task.id}-turn-${turnNumber}.txt`);
      await this.fileSystem.writeFile(developerPromptFile, promptDesteTurno).catch(() => {});

      // 3. CHAMA O OPENCLAW
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
      
      // 4. APLICA EVIDÊNCIAS DA EXECUÇÃO
      const evidence = this.evidenceService.createEmptyEvidence();
      this.evidenceService.applyExecutionEvidence(
        evidence,
        res.toolCall || {},
        res.toolResult || {},
        { executionDirectory: project?.pastaBase || TASKS_DIR }
      );
      
      // 5. ANALISA SE HÁ ARQUIVO .done FORA DO LOCAL ESPERADO (rogue done file)
      let doneExists = false;
      let actualDonePath = files.doneFile;
      
      const findDynamicDone = async (dir) => {
        if (!dir) return null;
        try {
          const dirFiles = await this.fileSystem.readdir(dir);
          const found = dirFiles.find(f => f.endsWith('.done'));
          return found ? this.path.join(dir, found) : null;
        } catch(e) { 
          return null; 
        }
      };
      
      const rogueDoneFile = (await findDynamicDone(TASKS_DIR)) || (await findDynamicDone(project?.pastaBase));
      
      if (rogueDoneFile) {
        doneExists = true;
        actualDonePath = rogueDoneFile;
        await this.log(`⚠️ [DeveloperTurnStep] Arquivo .done fora do local esperado: ${rogueDoneFile}`);
      }
      
      // 6. DETECTA TRUNCAMENTO DE TOOL CALL (JSON mal formado)
      let truncatedInfo = null;
      const raw = res.rawOutput || '';
      
      // Simulação simples de detecção de truncamento (simplificada para testes)
      if (raw.includes('{') && !raw.includes('}') || 
          raw.includes('[') && !raw.includes(']') ||
          raw.includes('"') && (raw.match(/"/g) || []).length % 2 !== 0) {
        truncatedInfo = {
          detected: true,
          likelyTool: 'unknown',
          reason: 'json_malformado'
        };
      }
      
      // 7. PREPARA FEEDBACK PARA PRÓXIMO TURNO (se necessário)
      let feedbackForNextTurn = null;
      let hasMeaningfulProgress = true;
      
      if (res.toolFeedback) {
        feedbackForNextTurn = res.toolFeedback;
        await this.log(`🛠️ [DeveloperTurnStep] Resultado da ferramenta capturado (${feedbackForNextTurn.length} chars)`);
      } else if (truncatedInfo && truncatedInfo.detected) {
        feedbackForNextTurn = `[ERRO DE SINTAXE DE FERRAMENTA] O bloco JSON foi cortado no meio (limite de caracteres) ou faltam aspas/chaves finais.\nPor favor, corrija e envie APENAS o JSON válido.`;
        hasMeaningfulProgress = false;
      } else if (/(concluíd[oa]|pronto|finalizad[oa]|terminei|aqui está|resolvido|feito)/i.test(raw) || raw.trim().length < 150) {
        feedbackForNextTurn = `[SISTEMA] Você respondeu com texto conversacional em vez de usar uma ferramenta.\nSe você acha que já terminou a implementação, use a ferramenta 'exec' com 'touch .done' para finalizar.`;
        hasMeaningfulProgress = false;
      } else if (raw.trim().length > 0) {
        feedbackForNextTurn = `[SISTEMA] Você está apenas narrando ou planejando em texto puro. Você deve AGIR.\nPara interagir com o sistema, é OBRIGATÓRIO emitir um bloco JSON válido contendo uma das ferramentas.\nSe precisar alterar código longo, prefira a ferramenta 'edit' em pedaços menores.`;
        hasMeaningfulProgress = false;
      }
      
      await this.log(`✅ [DeveloperTurnStep] Turno ${turnNumber} executado com sucesso`);
      
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
          truncatedInfo,
          hasMeaningfulProgress,
          feedbackForNextTurn,
          // Dados para próximo turno
          lastFeedback: feedbackForNextTurn,
          turnExecuted: true
        },
        // Propaga evidências para steps subsequentes
        evidence,
        currentOpenClawResult: res,
        doneFileExists: doneExists,
        actualDoneFilePath: actualDonePath
      };
      
    } catch (stepError) {
      await this.log(`💥 Erro no DeveloperTurnStep para tarefa ${task.id}, turno ${turnNumber}: ${stepError.message}`);
      
      return {
        ...context,
        turnResult: {
          success: false,
          error: stepError.message,
          turnNumber,
          turnExecuted: false
        },
        shouldAbort: true,
        abortReason: `Falha na execução do turno ${turnNumber}: ${stepError.message}`
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