// src/steps/EcosystemValidationStep.js
/**
 * Step responsável por validar o ecossistema do projeto (build, testes, etc.)
 * Executa após contrato cumprido para garantir que as alterações não quebraram o sistema.
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
class EcosystemValidationStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = options.log || container.resolve('log');
        // Usar instâncias fornecidas ou criar do container
        this.taskExecutionService = options.taskExecutionService || container.resolve('taskExecutionService');
        this.fileUtils = options.fileUtils || container.resolve('fileUtils');
        this.fileSystem = options.fileSystem || container.resolve('fileSystem');
    }
    /**
     * Executa a validação do ecossistema
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.config - Configuração
     * @param {Object} context.analysisPlan - Plano de análise (para determinar tipo de tarefa)
     * @param {Object} context.contractResult - Resultado da verificação de contrato
     * @param {string} context.actualDoneFilePath - Caminho do arquivo .done
     * @returns {Promise<Object>} Contexto atualizado com resultado da validação
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { task, project, config, analysisPlan, contractResult, actualDoneFilePath } = context;
            // Se contrato não foi cumprido, não precisa validar ecossistema
            if (contractResult && !contractResult.contractFulfilled) {
                yield this.log(`ℹ️ [Ecosistema] Contrato não cumprido, pulando validação de ecossistema`);
                return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                        success: true,
                        skipped: true,
                        reason: 'Contract not fulfilled'
                    } });
            }
            // Se não há projeto ou pasta base, não há o que validar
            if (!project || !project.pastaBase) {
                yield this.log(`ℹ️ [Ecosistema] Sem projeto ou pasta base, pulando validação`);
                return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                        success: true,
                        skipped: true,
                        reason: 'No project or base directory'
                    } });
            }
            // Para tarefas de análise/automação, não verificar ecossistema
            if (analysisPlan.taskType === 'analysis' || analysisPlan.taskType === 'automation') {
                yield this.log(`ℹ️ [Ecosistema] Tarefa de ${analysisPlan.taskType}, pulando validação de ecossistema`);
                return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                        success: true,
                        skipped: true,
                        reason: `Task type ${analysisPlan.taskType} does not require ecosystem validation`
                    } });
            }
            try {
                yield this.log(`🏗️ [Ecosistema] Validando ecossistema do projeto ${project.name}...`);
                // Chama a função de validação do TaskExecutionService
                const validationResult = yield this.taskExecutionService.ensureAndValidateEcosystem(task, project, config);
                if (validationResult.passed) {
                    yield this.log(`✅ [Ecosistema] Validação passou: ${validationResult.message || 'Ecossistema operacional'}`);
                    return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                            success: true,
                            passed: true,
                            message: validationResult.message,
                            details: validationResult
                        } });
                }
                else {
                    yield this.log(`❌ [Ecosistema] Validação falhou: ${validationResult.message || 'Ecossistema com problemas'}`);
                    // Se houver arquivo .done, remove porque a validação falhou
                    if (actualDoneFilePath) {
                        try {
                            yield this.fileSystem.unlink(actualDoneFilePath);
                            yield this.log(`🗑️ [Ecosistema] Arquivo .done removido devido a falha na validação`);
                        }
                        catch (unlinkError) {
                            yield this.log(`⚠️ [Ecosistema] Não foi possível remover .done: ${unlinkError.message}`);
                        }
                    }
                    return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                            success: true,
                            passed: false,
                            message: validationResult.message,
                            details: validationResult
                        }, 
                        // Prepara feedback para próximo turno
                        lastFeedback: `Validação de Ecossistema falhou:\n\n${validationResult.message}\n\nCorrija o código no módulo indicado e finalize novamente.`, contractResult: {
                            contractFulfilled: false,
                            executionNotes: `Validação de ecossistema falhou: ${validationResult.message}`
                        } });
                }
            }
            catch (stepError) {
                yield this.log(`💥 Erro no EcosystemValidationStep para tarefa ${task.id}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { ecosystemValidationResult: {
                        success: false,
                        error: stepError.message,
                        passed: false
                    }, shouldAbort: true, abortReason: `Falha na validação do ecossistema: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado da validação
     */
    static validateEcosystem(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new EcosystemValidationStep();
            const result = yield step.execute(context);
            return result.ecosystemValidationResult;
        });
    }
}
module.exports = EcosystemValidationStep;
