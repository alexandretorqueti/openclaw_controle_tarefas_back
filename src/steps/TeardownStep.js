// src/steps/TeardownStep.js
/**
 * Step responsável por finalizar a execução da tarefa, salvar logs e conteúdos
 * gerados no banco de dados e consolidar o resultado final.
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
class TeardownStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = options.log || container.resolve('log');
        this.fileSystem = options.fileSystem || container.resolve('fileSystem');
        this.path = options.path || container.resolve('path');
        // Usar instâncias fornecidas ou criar do container
        this.taskExecutionService = options.taskExecutionService || container.resolve('taskExecutionService');
        this.taskService = options.taskService || container.resolve('taskService');
        this.fileUtils = options.fileUtils || container.resolve('fileUtils');
    }
    /**
     * Executa o step de finalização (teardown)
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa
     * @param {Object} context.executionLogData - Dados do log de execução (para finalizar)
     * @param {Object} context.contractResult - Resultado final do contrato (do DeveloperLoopOrchestrator)
     * @param {Object} context.files - Arquivos preparados
     * @param {Object} context.config - Configuração
     * @param {string} context.architectPlan - Plano do arquiteto
     * @returns {Promise<Object>} Contexto atualizado com resultado final
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { task, executionLogData, files, config, architectPlan } = context;
            let { contractResult } = context;
            // Validação de segurança
            if (!contractResult) {
                yield this.log('❌ TeardownStep: contractResult é undefined!');
                contractResult = { contractFulfilled: false, executionNotes: 'Erro: contractResult não definido' };
            }
            // Consolidar resultado final
            const finalResult = {
                success: contractResult.contractFulfilled,
                executionNotes: contractResult.executionNotes || (contractResult.contractFulfilled ? 'Sucesso' : 'Falha na execução')
            };
            try {
                yield this.log(`🔧 [Teardown] Finalizando tarefa ${task.id}...`);
                // 1. Finaliza o log de execução no banco (se existir)
                if (executionLogData && executionLogData.id) {
                    // Recria o objeto de log de execução com base no ID e estado inicial para o finishExecutionLog
                    const fullExecutionLog = {
                        id: executionLogData.id,
                        taskId: executionLogData.taskId,
                        userId: executionLogData.userId,
                        model: executionLogData.model,
                        startedAt: executionLogData.startedAt,
                        // Adiciona os campos que finishExecutionLog vai atualizar
                        finishedAt: new Date(),
                        durationMs: new Date().getTime() - executionLogData.startedAt.getTime(),
                        success: finalResult.success,
                        exitCode: finalResult.success ? 0 : 1,
                        errorMessage: finalResult.success ? null : finalResult.executionNotes,
                        executionNotes: finalResult.executionNotes
                    };
                    // Chamar finishExecutionLog do TaskExecutionService
                    yield this.taskExecutionService.finishExecutionLog(fullExecutionLog.id, fullExecutionLog);
                    yield this.log(`💾 [Teardown] Log de execução ${executionLogData.id} finalizado.`);
                }
                // 2. Salvar conteúdos dos arquivos gerados no banco de dados
                const updateData = {};
                // Helper para ler arquivos com segurança
                const readFileSafe = (filePath) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        if (filePath && (yield this.fileUtils.fileExists(filePath))) {
                            const content = yield this.fileSystem.readFile(filePath, 'utf8');
                            yield this.log(`📄 [Teardown] LIDO: ${this.path.basename(filePath)} (${content.length} chars)`);
                            return content;
                        }
                    }
                    catch (error) {
                        yield this.log(`❌ [Teardown] ERRO ao ler ${this.path.basename(filePath)}: ${error.message}`);
                    }
                    return null;
                });
                const architectPromptFile = this.path.join(config.TASKS_DIR, `architect-prompt-${task.id}.txt`);
                updateData.arquitetosPromptContent = yield readFileSafe(architectPromptFile);
                if (!updateData.arquitetosPromptContent) {
                    yield this.log(`⚠️ [Teardown] Arquivo de prompt do arquiteto não encontrado: ${architectPromptFile}`);
                    updateData.arquitetosPromptContent = yield readFileSafe(files === null || files === void 0 ? void 0 : files.promptFile);
                }
                updateData.arquitetosAnalysisContent = (yield readFileSafe(files === null || files === void 0 ? void 0 : files.architectPlanFile)) || architectPlan || null;
                updateData.arquitetosTerminalContent = yield readFileSafe(files === null || files === void 0 ? void 0 : files.architectLogFile);
                updateData.programadorTerminalContent = yield readFileSafe(files === null || files === void 0 ? void 0 : files.terminalLogFile);
                updateData.programadorReportContent = yield readFileSafe(files === null || files === void 0 ? void 0 : files.relatorioFile);
                const finalUpdateData = Object.fromEntries(Object.entries(updateData).filter(([_, v]) => v !== null));
                if (Object.keys(finalUpdateData).length > 0 && task && task.id) {
                    yield this.log(`💾 [Teardown] ATUALIZANDO tarefa ${task.id} com ${Object.keys(finalUpdateData).length} campos de log...`);
                    yield this.taskService.updateTask(task.id, finalUpdateData);
                    yield this.log(`✅ [Teardown] Tarefa ${task.id} atualizada com sucesso pelo TaskService.`);
                }
                else if (task && task.id) {
                    yield this.log(`⚠️ [Teardown] Nenhum conteúdo de arquivo encontrado para salvar na tarefa ${task.id}`);
                }
                yield this.log(`✅ [Teardown] Finalização da tarefa ${task.id} concluída com sucesso`);
                return Object.assign(Object.assign({}, context), { finalResult });
            }
            catch (stepError) {
                yield this.log(`💥 Erro no TeardownStep para tarefa ${task.id}: ${stepError.message}\n${stepError.stack}`);
                return Object.assign(Object.assign({}, context), { finalResult: {
                        success: false,
                        executionNotes: `Falha crítica no teardown: ${stepError.message}`
                    }, shouldAbort: true, abortReason: `Falha crítica no teardown: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} context - Contexto completo
     * @returns {Promise<Object>} Resultado final
     */
    static finalizeTask(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new TeardownStep();
            const result = yield step.execute(context);
            return result.finalResult;
        });
    }
}
module.exports = TeardownStep;
