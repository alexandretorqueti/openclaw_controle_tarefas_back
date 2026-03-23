// src/steps/TaskExecutionOrchestrator.js
/**
 * Orchestrator principal que executa uma tarefa completa usando o pipeline de steps.
 * Substitui o método `executeTask` do TaskExecutionService.
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
class TaskExecutionOrchestrator {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = options.log || container.resolve('log');
    }
    /**
     * Executa uma tarefa completa usando o pipeline de steps
     * @param {Object} task - Tarefa a ser executada
     * @param {string} userId - ID do usuário
     * @param {Object} config - Configuração do sistema
     * @returns {Promise<Object>} Resultado da execução
     */
    executeTask(task, userId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            const initialContext = { task, userId, config };
            try {
                yield this.log(`🚀 [Orchestrator] Iniciando execução da tarefa ${task.id}: "${task.title}"`);
                // 1. SETUP CONTEXT
                yield this.log(`🔧 [Orchestrator] Executando SetupContextStep...`);
                const SetupContextStep = require('./SetupContextStep');
                const setupStep = new SetupContextStep();
                const setupResult = yield setupStep.execute(initialContext);
                if (setupResult.shouldAbort) {
                    yield this.log(`⏹️ [Orchestrator] Setup abortado: ${setupResult.abortReason}`);
                    return {
                        success: false,
                        executionNotes: `Setup abortado: ${setupResult.abortReason}`,
                        taskId: task.id
                    };
                }
                // 2. ARCHITECT PLANNING
                yield this.log(`🏗️ [Orchestrator] Executando ArchitectPlanningStep...`);
                const ArchitectPlanningStep = require('./ArchitectPlanningStep');
                const architectStep = new ArchitectPlanningStep();
                const architectResult = yield architectStep.execute(setupResult);
                if (architectResult.shouldAbort) {
                    yield this.log(`⏹️ [Orchestrator] Arquitetura abortada: ${architectResult.abortReason}`);
                    return {
                        success: false,
                        executionNotes: `Arquitetura abortada: ${architectResult.abortReason}`,
                        taskId: task.id
                    };
                }
                // 3. DEVELOPER LOOP
                yield this.log(`🔄 [Orchestrator] Executando DeveloperLoopOrchestrator...`);
                const DeveloperLoopOrchestrator = require('./DeveloperLoopOrchestrator');
                const developerOrchestrator = new DeveloperLoopOrchestrator();
                const developerResult = yield developerOrchestrator.execute(architectResult);
                if (developerResult.shouldAbort) {
                    yield this.log(`⏹️ [Orchestrator] Loop do desenvolvedor abortado: ${developerResult.abortReason}`);
                    return {
                        success: false,
                        executionNotes: `Loop do desenvolvedor abortado: ${developerResult.abortReason}`,
                        taskId: task.id
                    };
                }
                // 4. TEARDOWN
                yield this.log(`🔧 [Orchestrator] Executando TeardownStep...`);
                const TeardownStep = require('./TeardownStep');
                const teardownStep = new TeardownStep();
                const teardownResult = yield teardownStep.execute(Object.assign(Object.assign({}, developerResult), { contractResult: developerResult.contractResult || { contractFulfilled: false } }));
                if (teardownResult.shouldAbort) {
                    yield this.log(`⏹️ [Orchestrator] Teardown abortado: ${teardownResult.abortReason}`);
                    return {
                        success: false,
                        executionNotes: `Teardown abortado: ${teardownResult.abortReason}`,
                        taskId: task.id
                    };
                }
                // 5. RESULTADO FINAL
                const finalResult = teardownResult.finalResult || {
                    success: false,
                    executionNotes: 'Resultado final não definido'
                };
                yield this.log(`✅ [Orchestrator] Tarefa ${task.id} concluída: ${finalResult.success ? 'SUCESSO' : 'FALHA'}`);
                return {
                    success: finalResult.success,
                    executionNotes: finalResult.executionNotes,
                    taskId: task.id
                };
            }
            catch (error) {
                yield this.log(`💥 [FATAL Orchestrator] O pipeline falhou: ${error.message}\n${error.stack}`);
                return {
                    success: false,
                    executionNotes: `Falha crítica no pipeline: ${error.message}`,
                    taskId: task.id
                };
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa a ser executada
     * @param {string} userId - ID do usuário
     * @param {Object} config - Configuração do sistema
     * @returns {Promise<Object>} Resultado da execução
     */
    static execute(task, userId, config) {
        return __awaiter(this, void 0, void 0, function* () {
            const orchestrator = new TaskExecutionOrchestrator();
            return yield orchestrator.executeTask(task, userId, config);
        });
    }
}
module.exports = TaskExecutionOrchestrator;
