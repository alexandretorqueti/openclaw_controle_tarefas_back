// src/steps/DeveloperLoopOrchestrator.js
/**
 * Step que orquestra o loop completo do desenvolvedor.
 * Gerencia múltiplos turnos, verificação de contrato, validação de ecossistema e monitoramento de progresso.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const container = require('../container');
class DeveloperLoopOrchestrator {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = options.log || container.resolve('log');
        // Usar instâncias fornecidas ou criar do container
        this.sessionChainUtils = options.sessionChainUtils || container.resolve('sessionChainUtils');
        this.taskExecutionService = options.taskExecutionService || container.resolve('taskExecutionService');
        this.evidenceService = options.evidenceService || container.resolve('evidenceService');
        this.fileSystem = options.fileSystem || container.resolve('fileSystem');
        this.path = options.path || container.resolve('path');
    }
    /**
     * Executa o loop completo do desenvolvedor
     * @param {Object} context - Contexto do pipeline (deve conter dados dos steps anteriores)
     * @returns {Promise<Object>} Contexto atualizado com resultado do loop
     */
    execute(context) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const { task, project, files, config, analysisPlan, currentInput = '', architectAnalysis, architectPlan, initialSnapshot } = context;
            const { TASKS_DIR } = config;
            if (!task || !files || !config) {
                yield this.log(`⚠️ DeveloperLoopOrchestrator: contexto incompleto`);
                return Object.assign(Object.assign({}, context), { developerLoopResult: {
                        success: false,
                        error: 'contexto incompleto (task, files ou config faltando)'
                    } });
            }
            try {
                yield this.log(`🔄 [Desenvolvedor] Iniciando loop de execução (Modo Stateless)...`);
                // 1. VERIFICAR SE O ARQUITETO JÁ FEZ A TAREFA
                const architectVerification = yield this.taskExecutionService.verifyArchitectWork({
                    task, project, analysisPlan, files, initialSnapshot, config, architectAnalysis, architectPlan
                });
                let basePrompt = currentInput;
                if (architectVerification) {
                    if (architectVerification.success) {
                        yield this.log(`✅ [Desenvolvedor] Arquiteto já executou a tarefa, pulando loop`);
                        return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                success: true,
                                skipped: true,
                                reason: 'Architect already executed the task',
                                contractResult: architectVerification.contractResult,
                                finalResult: architectVerification.finalResult
                            }, contractResult: architectVerification.contractResult, finalResult: architectVerification.finalResult });
                    }
                    else if (architectVerification.needsDeveloper) {
                        basePrompt = architectVerification.message;
                        yield this.fileSystem.writeFile(files.promptFile, basePrompt);
                        yield this.log(`🔄 [Desenvolvedor] Necessita intervenção: ${architectVerification.message.substring(0, 100)}...`);
                    }
                }
                else {
                    basePrompt = `${currentInput || ''}\n\n === PLANO DO ARQUITETO ===\n ${architectPlan}\n\n`;
                }
                // 2. PREPARAÇÃO DO PROTOCOLO AMNÉSIA E CONTEXTO DE DEPENDÊNCIAS
                let contextFromPreviousTasks = '';
                try {
                    const taskChain = yield this.sessionChainUtils.getTaskChain(task.id);
                    const previousTasks = taskChain.filter(t => t.id !== task.id);
                    if (previousTasks.length > 0) {
                        contextFromPreviousTasks += `\n\n=== CONTEXTO DAS TAREFAS ANTERIORES ===\n`;
                        contextFromPreviousTasks += `Você está continuando um trabalho. Abaixo estão os relatórios e logs das tarefas que vieram antes desta:\n`;
                        for (const prevTask of previousTasks) {
                            const prevReport = yield this.taskExecutionService.readTaskOutputFile(prevTask.id, config.TASKS_DIR, 'relatorio');
                            const prevTerminal = yield this.taskExecutionService.readTaskOutputFile(prevTask.id, config.TASKS_DIR, 'terminal');
                            contextFromPreviousTasks += `\n--- Tarefa Anterior: ${prevTask.id} (${prevTask.title}) ---\n`;
                            if (prevReport) {
                                contextFromPreviousTasks += `Relatório gerado:\n${prevReport}\n`;
                            }
                            if (prevTerminal) {
                                contextFromPreviousTasks += `Últimas linhas do terminal:\n${prevTerminal.slice(-1500)}\n`;
                            }
                        }
                        contextFromPreviousTasks += `=== FIM DO CONTEXTO ANTERIOR ===\n\n`;
                        yield this.log(`📚 [Desenvolvedor] Contexto de ${previousTasks.length} tarefas anteriores carregado.`);
                    }
                }
                catch (chainErr) {
                    yield this.log(`⚠️ [Desenvolvedor] Erro ao buscar cadeia de dependências: ${chainErr.message}`);
                }
                basePrompt += contextFromPreviousTasks;
                // 3. CONFIGURAÇÃO DO LOOP
                const backupAgent = task.fallbackAgent || (project === null || project === void 0 ? void 0 : project.fallbackAgent) || 'main';
                let lastFeedback = null;
                let contractResult = { contractFulfilled: false };
                let turnos = 0;
                let turnosSemProgresso = 0;
                let finalContractResult = null;
                const maxTurns = 15;
                const maxTurnsWithoutProgress = 6;
                // 4. LOOP PRINCIPAL
                while (!contractResult.contractFulfilled && turnos < maxTurns) {
                    turnos++;
                    yield this.log(`🤖 Turno ${turnos}/${maxTurns} para tarefa ${task.id}...`);
                    // Importa e executa o DeveloperTurnStep
                    const DeveloperTurnStep = require('./DeveloperTurnStep');
                    const turnStep = new DeveloperTurnStep();
                    const turnContext = Object.assign(Object.assign({}, context), { basePrompt,
                        lastFeedback, turnNumber: turnos, backupAgent });
                    const turnResult = yield turnStep.execute(turnContext);
                    if (!turnResult.turnResult.success) {
                        yield this.log(`💥 [Desenvolvedor] Turno ${turnos} falhou: ${turnResult.turnResult.error}`);
                        return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                success: false,
                                error: `Turno ${turnos} falhou: ${turnResult.turnResult.error}`,
                                turnsExecuted: turnos
                            }, shouldAbort: true, abortReason: `Falha no turno ${turnos}: ${turnResult.turnResult.error}` });
                    }
                    // Atualiza contexto com resultados do turno
                    Object.assign(context, turnResult);
                    // 5. VERIFICAÇÃO DE CONTRATO APÓS CADA TURNO
                    const ContractVerificationStep = require('./ContractVerificationStep');
                    const contractStep = new ContractVerificationStep();
                    const contractContext = Object.assign(Object.assign({}, context), { evidence: turnResult.evidence, actualDoneFilePath: turnResult.actualDoneFilePath });
                    const contractVerificationResult = yield contractStep.execute(contractContext);
                    if (!contractVerificationResult.contractVerificationResult.success) {
                        yield this.log(`💥 [Desenvolvedor] Verificação de contrato falhou no turno ${turnos}`);
                        return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                success: false,
                                error: `Verificação de contrato falhou: ${contractVerificationResult.contractVerificationResult.error}`,
                                turnsExecuted: turnos
                            }, shouldAbort: true, abortReason: `Verificação de contrato falhou no turno ${turnos}` });
                    }
                    contractResult = contractVerificationResult.contractResult ||
                        { contractFulfilled: false };
                    // 6. SE CONTRATO CUMPRIDO, VALIDA ECOSSISTEMA
                    if (contractResult.contractFulfilled) {
                        yield this.log(`✅ [Desenvolvedor] Contrato cumprido no turno ${turnos}, validando ecossistema...`);
                        const EcosystemValidationStep = require('./EcosystemValidationStep');
                        const ecosystemStep = new EcosystemValidationStep();
                        const ecosystemContext = Object.assign(Object.assign({}, context), { contractResult, actualDoneFilePath: turnResult.actualDoneFilePath });
                        const ecosystemResult = yield ecosystemStep.execute(ecosystemContext);
                        if (!ecosystemResult.ecosystemValidationResult.success) {
                            yield this.log(`💥 [Desenvolvedor] Validação de ecossistema falhou (Erro sistêmico)`);
                            return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                    success: false,
                                    error: `Validação de ecossistema falhou: ${ecosystemResult.ecosystemValidationResult.error}`,
                                    turnsExecuted: turnos
                                }, shouldAbort: true, abortReason: `Validação de ecossistema falhou no turno ${turnos}` });
                        }
                        if (!ecosystemResult.ecosystemValidationResult.passed) {
                            // Validação falhou (código quebrado, lint, etc), continua loop com feedback
                            lastFeedback = ecosystemResult.lastFeedback;
                            contractResult.contractFulfilled = false;
                            // CORREÇÃO: Incrementa a estagnação se a IA ficar presa quebrando o ecossistema
                            turnosSemProgresso++;
                            yield this.log(`🔄 [Desenvolvedor] Ecossistema falhou, continuando loop com feedback...`);
                            // Verifica estagnação específica do ecossistema
                            if (turnosSemProgresso >= maxTurnsWithoutProgress) {
                                const abortMsg = `Estagnação detectada no Ecossistema (${maxTurnsWithoutProgress} turnos falhando validação)`;
                                yield this.log(`⏹️ [Desenvolvedor] ${abortMsg}`);
                                const finalContract = Object.assign(Object.assign({}, contractResult), { contractFulfilled: false, executionNotes: abortMsg });
                                // Retorna FALSE imediatamente
                                return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                        success: false,
                                        error: abortMsg,
                                        turnsExecuted: turnos,
                                        contractFulfilled: false,
                                        finalContractResult: finalContract
                                    }, contractResult: finalContract, shouldAbort: true, abortReason: abortMsg });
                            }
                            continue;
                        }
                        // Sucesso! Contrato cumprido e ecossistema validado
                        finalContractResult = contractResult;
                        yield this.log(`🎉 [Desenvolvedor] Tarefa ${task.id} concluída com sucesso em ${turnos} turnos!`);
                        break;
                    }
                    // 7. ANÁLISE DE PROGRESSO E PREPARAÇÃO DO PRÓXIMO TURNO
                    lastFeedback = turnResult.turnResult.feedbackForNextTurn;
                    // Calcula progresso
                    const progress = this.evidenceService.computeTurnProgress(((_a = turnResult.currentOpenClawResult) === null || _a === void 0 ? void 0 : _a.toolResult) || {}, contractResult, (project === null || project === void 0 ? void 0 : project.pastaBase) || TASKS_DIR);
                    if (progress.hasMeaningfulProgress) {
                        turnosSemProgresso = 0;
                        yield this.log(`📈 [Desenvolvedor] Progresso significativo no turno ${turnos}`);
                    }
                    else {
                        turnosSemProgresso++;
                        yield this.log(`⚠️ [Desenvolvedor] Turno ${turnos} sem progresso significativo (${turnosSemProgresso}/${maxTurnsWithoutProgress})`);
                    }
                    // Verifica estagnação principal
                    if (turnosSemProgresso >= maxTurnsWithoutProgress) {
                        const abortMsg = `Estagnação de IA detectada (${maxTurnsWithoutProgress} turnos sem progresso real)`;
                        yield this.log(`⏹️ [Desenvolvedor] ${abortMsg}`);
                        const finalContract = Object.assign(Object.assign({}, contractResult), { contractFulfilled: false, executionNotes: abortMsg });
                        // Retorna FALSE imediatamente
                        return Object.assign(Object.assign({}, context), { developerLoopResult: {
                                success: false,
                                error: abortMsg,
                                turnsExecuted: turnos,
                                contractFulfilled: false,
                                finalContractResult: finalContract
                            }, contractResult: finalContract, shouldAbort: true, abortReason: abortMsg });
                    }
                } // FIM DO LOOP WHILE
                // 8. RESULTADO FINAL (Só chega aqui se houver break de SUCESSO ou bater limite maxTurns)
                if (!finalContractResult) {
                    finalContractResult = contractResult || { contractFulfilled: false, executionNotes: 'Loop finalizado sem validação clara' };
                }
                // Se bateu maxTurns (15) mas não cumpriu contrato
                if (!finalContractResult.contractFulfilled) {
                    return Object.assign(Object.assign({}, context), { developerLoopResult: {
                            success: false,
                            error: `Limite de turnos atingido (${maxTurns}) sem cumprir o contrato.`,
                            turnsExecuted: turnos,
                            contractFulfilled: false,
                            finalContractResult
                        }, contractResult: finalContractResult, shouldAbort: true, abortReason: `Limite de ${maxTurns} turnos atingido.` });
                }
                yield this.log(`📊 [Desenvolvedor] Loop finalizado com sucesso. turnos: ${turnos}`);
                return Object.assign(Object.assign({}, context), { developerLoopResult: {
                        success: true,
                        contractFulfilled: true,
                        turnsExecuted: turnos,
                        finalContractResult,
                        executionNotes: finalContractResult.executionNotes
                    }, contractResult: finalContractResult });
            }
            catch (stepError) {
                yield this.log(`💥 Erro no DeveloperLoopOrchestrator para tarefa ${task.id}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { developerLoopResult: {
                        success: false,
                        error: stepError.message,
                        contractFulfilled: false
                    }, shouldAbort: true, abortReason: `Falha no loop do desenvolvedor: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado do loop
     */
    static executeLoop(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const orchestrator = new DeveloperLoopOrchestrator();
            const result = yield orchestrator.execute(context);
            return result.developerLoopResult;
        });
    }
}
module.exports = DeveloperLoopOrchestrator;
