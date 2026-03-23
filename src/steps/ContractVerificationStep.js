// src/steps/ContractVerificationStep.js
/**
 * Step responsável por verificar se o contrato da tarefa foi cumprido.
 * Verifica arquivos .done, relatório, evidências e snapshot changes.
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
class ContractVerificationStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = options.log || container.resolve('log');
        // Usar instâncias fornecidas ou criar do container
        this.contractVerificationService = options.contractVerificationService || container.resolve('contractVerificationService');
        this.evidenceService = options.evidenceService || container.resolve('evidenceService');
        this.fileUtils = options.fileUtils || container.resolve('fileUtils');
        this.workspaceSnapshotService = options.workspaceSnapshotService || container.resolve('workspaceSnapshotService');
    }
    /**
     * Executa a verificação de contrato
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.project - Projeto (pode ser null)
     * @param {Object} context.files - Arquivos preparados
     * @param {Object} context.config - Configuração
     * @param {Object} context.evidence - Evidências coletadas (do DeveloperTurnStep)
     * @param {Object} context.analysisPlan - Plano de análise
     * @param {Map} context.initialSnapshot - Snapshot inicial
     * @param {string} context.actualDoneFilePath - Caminho real do arquivo .done (pode ser diferente do esperado)
     * @returns {Promise<Object>} Contexto atualizado com resultado da verificação
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { task, project, files, config, evidence, analysisPlan, initialSnapshot, actualDoneFilePath } = context;
            if (!task || !files || !config) {
                yield this.log(`⚠️ ContractVerificationStep: contexto incompleto`);
                return Object.assign(Object.assign({}, context), { contractVerificationResult: {
                        success: false,
                        error: 'contexto incompleto (task, files ou config faltando)'
                    } });
            }
            try {
                yield this.log(`📋 [Contrato] Verificando cumprimento do contrato para tarefa ${task.id}...`);
                // Usa o caminho real do .done se fornecido, senão o padrão
                const doneFilePath = actualDoneFilePath || files.doneFile;
                const relatorioFilePath = files.relatorioFile;
                const terminalLogFilePath = files.terminalLogFile;
                // 1. VERIFICA SE ARQUIVOS EXISTEM
                const doneExists = yield this.fileUtils.fileExists(doneFilePath);
                const reportExists = yield this.fileUtils.fileExists(relatorioFilePath);
                yield this.log(`📁 [Contrato] doneFile existe: ${doneExists} (${doneFilePath})`);
                yield this.log(`📁 [Contrato] relatorioFile existe: ${reportExists}`);
                // 2. CHAMA O SERVIÇO DE VERIFICAÇÃO DE CONTRATO
                const contractResult = yield this.contractVerificationService.verifyContract(doneFilePath, relatorioFilePath, terminalLogFilePath, {
                    taskType: analysisPlan.taskType,
                    evidence: evidence || this.evidenceService.createEmptyEvidence(),
                    task,
                    project,
                    analysisPlan,
                    initialSnapshot
                });
                yield this.log(`📊 [Contrato] Resultado: contractFulfilled=${contractResult.contractFulfilled}`);
                if (contractResult.contractFulfilled) {
                    yield this.log(`✅ [Contrato] Contrato cumprido com sucesso!`);
                    if (contractResult.executionNotes) {
                        yield this.log(`📝 [Contrato] Notas: ${contractResult.executionNotes}`);
                    }
                }
                else {
                    yield this.log(`⚠️ [Contrato] Contrato NÃO cumprido`);
                    if (contractResult.feedbackToAgent) {
                        yield this.log(`💬 [Contrato] Feedback para agente: ${contractResult.feedbackToAgent.substring(0, 200)}...`);
                    }
                    if (contractResult.missingRequirements && contractResult.missingRequirements.length > 0) {
                        yield this.log(`📋 [Contrato] Requisitos faltando: ${contractResult.missingRequirements.join(', ')}`);
                    }
                }
                return Object.assign(Object.assign({}, context), { contractVerificationResult: {
                        success: true,
                        contractFulfilled: contractResult.contractFulfilled,
                        executionNotes: contractResult.executionNotes,
                        feedbackToAgent: contractResult.feedbackToAgent,
                        missingRequirements: contractResult.missingRequirements || [],
                        evidence: contractResult.evidence || {}
                    }, contractResult // Mantém compatibilidade com código existente
                 });
            }
            catch (stepError) {
                yield this.log(`💥 Erro no ContractVerificationStep para tarefa ${task.id}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { contractVerificationResult: {
                        success: false,
                        error: stepError.message,
                        contractFulfilled: false
                    }, shouldAbort: true, abortReason: `Falha na verificação de contrato: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado da verificação
     */
    static verifyContract(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new ContractVerificationStep();
            const result = yield step.execute(context);
            return result.contractVerificationResult;
        });
    }
}
module.exports = ContractVerificationStep;
