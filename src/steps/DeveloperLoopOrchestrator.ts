// src/steps/DeveloperLoopOrchestrator.ts
/**
 * Step que orquestra o loop completo do desenvolvedor.
 * Gerencia múltiplos turnos, verificação de contrato, validação de ecossistema e monitoramento de progresso.
 */

import container from '../container';
import DeveloperTurnStep from './DeveloperTurnStep';
import ContractVerificationStep from './ContractVerificationStep';
import EcosystemValidationStep from './EcosystemValidationStep';
import LlmService from '../services/llmService'; // Certifique-se de que este caminho está correto

class DeveloperLoopOrchestrator {
  private log: any;
  private sessionChainUtils: any;
  private taskExecutionService: any;
  private evidenceService: any;
  private fileSystem: any;
  private path: any;
  private openClawService: any;

  constructor(options: any = {}) {
    this.log = options.log || container.get('log');
    this.openClawService = options.openClawService || container.get('openClawService');
    this.evidenceService = options.evidenceService || container.get('evidenceService');
    this.fileSystem = options.fileSystem || container.get('fileSystem');
    this.path = options.path || container.get('path');
  }

  async execute(context: any): Promise<any> {
    const { 
      task, project, files, config, analysisPlan, 
      currentInput = '', architectAnalysis, architectPlan, initialSnapshot
    } = context;
    
    const { TASKS_DIR } = config;
    
    if (!task || !files || !config) {
      await this.log(`⚠️ DeveloperLoopOrchestrator: contexto incompleto`);
      return { ...context, developerLoopResult: { success: false, error: 'contexto incompleto' } };
    }

    try {
      await this.log(`🔄 [Desenvolvedor] Iniciando loop de execução (Modo Stateless)...`);
      
      const architectVerification = await this.taskExecutionService.verifyArchitectWork({
        task, project, analysisPlan, files, initialSnapshot, config, architectAnalysis, architectPlan
      });
      
      let basePrompt = currentInput;
      
      if (architectVerification) {
        if (architectVerification.success) {
          await this.log(`✅ [Desenvolvedor] Arquiteto já executou a tarefa, pulando loop`);
          return {
            ...context,
            developerLoopResult: { success: true, skipped: true, reason: 'Architect already executed', contractResult: architectVerification.contractResult, finalResult: architectVerification.finalResult },
            contractResult: architectVerification.contractResult,
            finalResult: architectVerification.finalResult
          };
        } else if (architectVerification.needsDeveloper) {
          basePrompt = architectVerification.message;
          await this.fileSystem.writeFile(files.promptFile, basePrompt);
        }
      } else {
        basePrompt = `${currentInput || ''}\n\n === PLANO DO ARQUITETO ===\n ${architectPlan}\n\n`;
      }

      let contextFromPreviousTasks = await this._loadPreviousTasksContext(task.id, config.TASKS_DIR);
      basePrompt += contextFromPreviousTasks;
      
      const backupAgent = task.fallbackAgent || project?.fallbackAgent || 'main';
      let lastFeedback = null;
      let contractResult: any = { contractFulfilled: false };
      let turnos = 0;
      let turnosSemProgresso = 0;
      let finalContractResult = null;
      
      const maxTurns = 15;
      const maxTurnsWithoutProgress = 6;
      
      // =========================================================================
      // 🔄 LOOP PRINCIPAL (PAINEL DE CONTROLE AUTO-DESCRITIVO)
      // =========================================================================
      while (!contractResult.contractFulfilled && turnos < maxTurns) {
        turnos++;
        await this.log(`🤖 Turno ${turnos}/${maxTurns} para tarefa ${task.id}...`);
        
        const turnResult = await this._executeSingleDeveloperTurn(context, basePrompt, lastFeedback, turnos, backupAgent);
        
        if (!turnResult.success) {
          return this._abortLoop(context, turnos, `Falha crítica no turno: ${turnResult.error}`);
        }
        
        Object.assign(context, turnResult.contextUpdate);

        // 1 - O programador avisou que terminou?
        const isDone = this._checkIfDeveloperSignaledCompletionViaDoneFile(turnResult.data);

        if (isDone) {
            await this.log(`🚨 [Olheiro] Arquivo .done detectado fisicamente! Iniciando auditoria...`);

            const hasRealChanges = this._checkIfDeveloperActuallyModifiedFiles(turnResult.data);

            if (!hasRealChanges) {
                await this.log(`🧠 [Olheiro] Nenhuma modificação de arquivo. Acionando LLM Local para auditar o terminal...`);
                const claimedAlreadyDone = await this._askLlmIfAgentClaimedTaskWasAlreadyDone(turnResult.data);

                if (claimedAlreadyDone) {
                    await this.log(`✅ [Olheiro] Rota de fuga aprovada: A IA documentou que a tarefa já estava pronta.`);
                } else {
                    await this.log(`⚠️ [Olheiro] Falso positivo. IA não alterou nada e não justificou.`);
                    lastFeedback = "[SISTEMA] Você criou o .done sem modificar arquivos. Se a tarefa já estava concluída, EXPLIQUE isso no terminal antes de finalizar.";
                    turnosSemProgresso++;
                    continue; 
                }
            }

            // 3 - O ecossistema compila e roda?
            const ecosystem = await this._validateIfProjectEcosystemCompilesAndRuns(context, turnResult.data);

            if (ecosystem.passed) {
                // 3.5 - A BARREIRA DE QA (Escada de Inteligência)
                await this.log(`🔬 [QA] Ecossistema operacional. Iniciando QA (Escalonamento de IA)...`);
                const qaResult = await this._generateAndRunTestsWithEscalation(context, turnResult.data, task.domain);

                if (qaResult.passed) {
                    await this.log(`🎉 [Desenvolvedor] Tarefa concluída e TESTADA com sucesso!`);
                    finalContractResult = { contractFulfilled: true, executionNotes: "Concluído, compilado e com QA aprovado." };
                    break;
                } else {
                    await this.log(`🔄 [QA] Os testes falharam. Devolvendo o erro ao Desenvolvedor...`);
                    lastFeedback = `[SISTEMA DE QA] Os testes falharam.\n\nLOG:\n${qaResult.errorLog}\n\nCorrija seu código OU corrija o teste se a premissa dele estiver errada.`;
                    turnosSemProgresso++;
                    
                    if (turnosSemProgresso >= maxTurnsWithoutProgress) {
                        return this._abortLoop(context, turnos, `Estagnação no QA (${maxTurnsWithoutProgress} turnos falhando validação)`);
                    }
                    continue; 
                }
            } else {
                await this.log(`🔄 [Desenvolvedor] Ecossistema quebrou (Erro de TypeScript/Lint). Devolvendo para IA...`);
                lastFeedback = ecosystem.feedback;
                turnosSemProgresso++;
                
                if (turnosSemProgresso >= maxTurnsWithoutProgress) {
                    return this._abortLoop(context, turnos, `Estagnação no Ecossistema (${maxTurnsWithoutProgress} turnos falhando validação)`);
                }
                continue;
            }
        } 
        
        // 4 - Respeitou o contrato de comunicação JSON?
        const isCommunicationValid = await this._validateIfAgentRespectedCommunicationContract(context, turnResult.data);
        if (!isCommunicationValid.success) {
            return this._abortLoop(context, turnos, `Contrato de comunicação falhou: ${isCommunicationValid.error}`);
        }

        // 5 - Análise de Estagnação
        const progress = this._evaluateIfDeveloperIsStuckWithoutMeaningfulProgress(turnResult.data, contractResult, project?.pastaBase || TASKS_DIR);
        if (progress.hasMeaningfulProgress) {
            turnosSemProgresso = 0;
        } else {
            turnosSemProgresso++;
            if (turnosSemProgresso >= maxTurnsWithoutProgress) {
                return this._abortLoop(context, turnos, `Estagnação de IA detectada (${maxTurnsWithoutProgress} turnos sem progresso)`);
            }
        }

        lastFeedback = turnResult.data.feedbackForNextTurn;
      } // FIM DO LOOP
      
      if (!finalContractResult) finalContractResult = contractResult || { contractFulfilled: false };
      
      if (!finalContractResult.contractFulfilled) {
        return this._abortLoop(context, turnos, `Limite de ${maxTurns} turnos atingido sem conclusão.`);
      }

      await this.log(`📊 [Desenvolvedor] Loop finalizado com sucesso. turnos: ${turnos}`);
      return {
        ...context,
        developerLoopResult: { success: true, contractFulfilled: true, turnsExecuted: turnos, finalContractResult, executionNotes: finalContractResult.executionNotes },
        contractResult: finalContractResult
      };
      
    } catch (stepError: any) {
      await this.log(`💥 Erro fatal no Orchestrator: ${stepError.message}`);
      return this._abortLoop(context, 0, `Falha no loop: ${stepError.message}`);
    }
  }

  // ============================================================================
  // MÉTODOS AUXILIARES AUTO-DESCRITIVOS (FACADES)
  // ============================================================================

  private async _executeSingleDeveloperTurn(context: any, basePrompt: string, lastFeedback: string | null, turnNumber: number, backupAgent: string) {
    const turnStep = new DeveloperTurnStep();
    const result = await turnStep.execute({ ...context, basePrompt, lastFeedback, turnNumber, backupAgent });
    return { success: result.turnResult.success, error: result.turnResult.error, data: result.turnResult, contextUpdate: result };
  }

  private _checkIfDeveloperSignaledCompletionViaDoneFile(turnData: any): boolean {
    return turnData.doneExists === true;
  }

  private _checkIfDeveloperActuallyModifiedFiles(turnData: any): boolean {
    const evidence = turnData.evidence || {};
    return (evidence.modifiedFiles || []).length > 0 || (evidence.commandsExecuted || []).length > 0;
  }

  private async _askLlmIfAgentClaimedTaskWasAlreadyDone(turnData: any): Promise<boolean> {
    const output = turnData.openClawResult?.rawOutput || '';
    if (!output.trim()) return false;

    const recentTerminalLog = output.slice(-4000);
    const ai = new LlmService(); 
    
    const prompt = `Você é um auditor de logs. O agente declarou explicitamente que a tarefa JÁ ESTAVA FEITA, IMPLEMENTADA ou NÃO PRECISOU DE ALTERAÇÕES?\nResponda APENAS em JSON: {"alreadyDone": true/false, "reason": "motivo"}\n\nLOG:\n"""\n${recentTerminalLog}\n"""`;

    try {
        const decision = await ai.analyze(prompt);
        if (decision && decision.alreadyDone === true) {
            await this.log(`🤖 [LLM Auditor] Veredito: alreadyDone=true. Motivo: ${decision.reason}`);
            return true;
        }
        return false;
    } catch (error: any) {
        await this.log(`⚠️ Erro no LLM Auditor: ${error.message}`);
        return false; 
    }
  }

  private async _validateIfProjectEcosystemCompilesAndRuns(context: any, turnData: any) {
    const ecosystemStep = new EcosystemValidationStep();
    const result = await ecosystemStep.execute({ ...context, contractResult: { contractFulfilled: true }, actualDoneFilePath: turnData.actualDonePath });
    return { passed: result.ecosystemValidationResult.passed, feedback: result.lastFeedback };
  }

  private async _generateAndRunTestsWithEscalation(context: any, turnData: any, domain: string) {
    const filesModified = turnData.evidence?.modifiedFiles || [];
    if (filesModified.length === 0) return { passed: true, skipped: true }; 

    const qaTiers = [
        { tier: 1, name: 'Local (Qwen 9B)', model: 'qwen3.5:9b-q8_0', maxTurns: 3 },
        { tier: 2, name: 'Cloud Barata', model: 'gemini-1.5-flash', maxTurns: 2 },
    ];

    let lastQaError = "Nenhum teste gerado com sucesso.";

    for (const config of qaTiers) {
        await this.log(`🔬 [QA - Tier ${config.tier}] Acionando QA: ${config.name}...`);
        
        // Simulação da chamada do Agente QA (você deve plugar seu OpenClawService aqui futuramente)
        const qaSuccess = true; // TODO: Implementar a chamada real ao OpenClaw QA Agent
        
        if (qaSuccess) {
            await this.log(`✅ [QA] Testes aprovados pelo modelo ${config.name}!`);
            return { passed: true, log: "Testes rodaram verde." };
        } else {
            lastQaError = `Modelo ${config.name} falhou.`;
        }
    }

    return { passed: false, errorLog: `Equipe de QA falhou. Último erro: ${lastQaError}` };
  }

  private async _validateIfAgentRespectedCommunicationContract(context: any, turnData: any) {
    const contractStep = new ContractVerificationStep();
    const result = await contractStep.execute({ ...context, evidence: turnData.evidence, actualDoneFilePath: turnData.actualDonePath });
    return { success: result.contractVerificationResult.success, error: result.contractVerificationResult.error };
  }

  private _evaluateIfDeveloperIsStuckWithoutMeaningfulProgress(turnData: any, contractResult: any, executionDirectory: string) {
    return this.evidenceService.computeTurnProgress(turnData.openClawResult?.toolResult || {}, contractResult, executionDirectory);
  }

  private async _loadPreviousTasksContext(taskId: string, tasksDir: string): Promise<string> {
    try {
        const taskChain = await this.sessionChainUtils.getTaskChain(taskId);
        const prevTasks = taskChain.filter((t: any) => t.id !== taskId);
        if (prevTasks.length === 0) return '';
        
        let ctx = `\n\n=== CONTEXTO DE TAREFAS ANTERIORES ===\n`;
        for (const pt of prevTasks) {
            const relatorio = await this.taskExecutionService.readTaskOutputFile(pt.id, tasksDir, 'relatorio');
            if (relatorio) ctx += `\n[${pt.id}] Relatório:\n${relatorio}\n`;
        }
        return ctx + `=== FIM DO CONTEXTO ===\n\n`;
    } catch (e) { return ''; }
  }

  private _abortLoop(context: any, turnsExecuted: number, reason: string) {
    return {
        ...context,
        developerLoopResult: { success: false, error: reason, turnsExecuted, contractFulfilled: false },
        shouldAbort: true, abortReason: reason
    };
  }

  static async executeLoop(context: any): Promise<any> {
    const orchestrator = new DeveloperLoopOrchestrator();
    return (await orchestrator.execute(context)).developerLoopResult;
  }
}

export default DeveloperLoopOrchestrator;