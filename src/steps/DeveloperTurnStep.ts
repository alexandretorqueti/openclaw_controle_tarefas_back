// src/steps/DeveloperTurnStep.ts
/**
 * Step responsável por executar um turno individual do desenvolvedor.
 * Inclui geração de sessão, execução via OpenClaw e coleta básica de evidências.
 */

import container from '../container';

class DeveloperTurnStep {
  private log: any;
  private openClawService: any;
  private evidenceService: any;
  private fileSystem: any;
  private path: any;

  /**
   * Construtor que obtém dependências do container.
   * Aceita instâncias opcionais para facilitar testes.
   */
  constructor(options: any = {}) {
    this.log = options.log || container.get('log');
    this.openClawService = options.openClawService || container.get('openClawService');
    this.evidenceService = options.evidenceService || container.get('evidenceService');
    this.fileSystem = options.fileSystem || container.get('fileSystem');
    this.path = options.path || container.get('path');
  }

  /**
   * Executa um turno do desenvolvedor
   */
  async execute(context: any): Promise<any> {
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
      
      // 5. ANALISA SE HÁ ARQUIVO .done FORA DO LOCAL ESPERADO
      let doneExists = false;
      let actualDonePath = files.doneFile;
      
      const findDynamicDone = async (dir: string): Promise<string | null> => {
        if (!dir) return null;
        try {
          const dirFiles = await this.fileSystem.readdir(dir);
          const found = dirFiles.find((f: string) => f.endsWith('.done'));
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
      
      // 6. DETECTA TRUNCAMENTO DE TOOL CALL
      let truncatedInfo = null;
      const raw = res.rawOutput || '';
      
      if (raw.includes('{') && !raw.includes('}') || 
          raw.includes('[') && !raw.includes(']') ||
          raw.includes('"') && (raw.match(/"/g) || []).length % 2 !== 0) {
        truncatedInfo = {
          detected: true,
          likelyTool: 'unknown',
          reason: 'json_malformado'
        };
      }
      
      // =====================================================================
      // 7. PREPARA FEEDBACK PARA PRÓXIMO TURNO E INTERCEPTA SUBMISSÃO
      // =====================================================================
      let feedbackForNextTurn = null;
      let hasMeaningfulProgress = true;
      
      const rawLower = raw.toLowerCase();
      const isAskingQuestion = rawLower.includes('would you like me to') || 
                               rawLower.includes('should i proceed') || 
                               rawLower.includes('posso continuar') || 
                               rawLower.includes('do you want me to');
      
      if (res.toolFeedback) {
        feedbackForNextTurn = res.toolFeedback;
        await this.log(`🛠️ [DeveloperTurnStep] Resultado da ferramenta capturado (${feedbackForNextTurn.length} chars)`);
      } else if (isAskingQuestion) {
        // A NOSSA TRAVA DE IA MEDROSA ENTRA AQUI!
        feedbackForNextTurn = `[ERRO DE PROTOCOLO] Você fez uma pergunta ou pediu permissão. Lembre-se: não há um humano no teclado para te responder. Assuma a melhor decisão técnica e simplesmente execute a alteração nos arquivos usando suas ferramentas.`;
        hasMeaningfulProgress = false;
        await this.log(`⚠️ [DeveloperTurnStep] IA detectada fazendo perguntas. Injetando feedback de correção de postura.`);
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
          lastFeedback: feedbackForNextTurn,
          turnExecuted: true
        },
        evidence,
        currentOpenClawResult: res,
        doneFileExists: doneExists,
        actualDoneFilePath: actualDonePath
      };
      
    } catch (stepError: any) {
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

  static async executeTurn(context: any): Promise<any> {
    const step = new DeveloperTurnStep();
    const result = await step.execute(context);
    return result.turnResult;
  }
}

export default DeveloperTurnStep;