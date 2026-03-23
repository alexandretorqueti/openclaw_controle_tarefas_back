// src/steps/TaskSuccessStep.js
/**
 * Step responsável por tratar sucesso na execução de tarefas.
 * Inclui logging, finalização na API, movimentação de arquivos e liberação de lock.
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
class TaskSuccessStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = container.resolve('log');
        this.config = container.resolve('config');
        this.axios = container.resolve('axios');
        // Usar instâncias fornecidas ou criar do container
        this.lockService = options.lockService || this._createLockService();
        this.stateService = options.stateService || this._createStateService();
        this.taskFileService = options.taskFileService || this._createTaskFileService();
    }
    /**
     * Cria instância do LockService com configuração
     * @private
     */
    _createLockService() {
        const LockServiceClass = container.resolve('LockServiceClass');
        const { LOCK_FILE } = this.config;
        return new LockServiceClass(LOCK_FILE);
    }
    /**
     * Cria instância do MonitorStateService com configuração
     * @private
     */
    _createStateService() {
        const MonitorStateServiceClass = container.resolve('MonitorStateServiceClass');
        const { TASKS_DIR } = this.config;
        return new MonitorStateServiceClass(TASKS_DIR);
    }
    /**
     * Cria instância do TaskFileService
     * @private
     */
    _createTaskFileService() {
        const TaskFileServiceClass = container.resolve('TaskFileServiceClass');
        return new TaskFileServiceClass();
    }
    /**
     * Executa o step de tratamento de sucesso
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa executada com sucesso
     * @param {Object} context.executionResult - Resultado da execução
     * @param {string} context.userId - ID do usuário (opcional, usa config.MY_USER_ID por padrão)
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { task, executionResult } = context;
            const userId = context.userId || this.config.MY_USER_ID || null;
            const apiUrl = context.apiUrl || this.config.API_URL;
            const { TASKS_DIR, PROCESSED_DIR } = this.config;
            if (!task || !executionResult) {
                yield this.log(`⚠️ TaskSuccessStep: task ou executionResult não fornecidos`);
                return Object.assign(Object.assign({}, context), { successResult: {
                        success: false,
                        error: 'task ou executionResult não fornecidos'
                    } });
            }
            try {
                yield this.log(`✅ Tarefa ${task.id} executada com sucesso!`);
                // 1. Atualiza status da tarefa na API (se tiver userId)
                if (userId) {
                    try {
                        yield this.axios.patch(`${apiUrl}/api/tasks/${task.id}/finalize`, {
                            userId,
                            executionNotes: executionResult.executionNotes || 'Executado com sucesso'
                        });
                        yield this.log(`📝 Tarefa ${task.id} finalizada na API`);
                    }
                    catch (apiError) {
                        yield this.log(`❌ Erro ao finalizar a tarefa na API: ${apiError.message}`);
                        // Não falha o step inteiro, apenas loga o erro
                    }
                }
                else {
                    yield this.log(`⚠️ Não foi possível finalizar tarefa na API pois userId é nulo.`);
                }
                // 2. Move arquivos para pasta de processados
                yield this.taskFileService.moveTaskFiles(task.id, TASKS_DIR, PROCESSED_DIR);
                yield this.log(`📁 Arquivos da tarefa ${task.id} movidos para ${PROCESSED_DIR}`);
                // 3. Limpa estado interno
                yield this.stateService.cleanupTask(task.id);
                yield this.log(`🧹 Estado da tarefa ${task.id} limpo`);
                // 4. Libera o lock para marcar isExecuting: false
                try {
                    yield this.lockService.releaseLock();
                    yield this.log(`🔓 Lock liberado para tarefa ${task.id} (isExecuting: false)`);
                }
                catch (lockError) {
                    yield this.log(`⚠️ Erro ao liberar lock: ${lockError.message}`);
                    // Não falha o step inteiro, apenas loga o erro
                }
                yield this.log(`✅ Sucesso da tarefa ${task.id} tratado com sucesso`);
                return Object.assign(Object.assign({}, context), { successResult: {
                        success: true,
                        taskId: task.id,
                        actionsTaken: [
                            'logged',
                            userId ? 'apiFinalized' : 'apiSkipped',
                            'filesMoved',
                            'stateCleaned',
                            'lockReleased'
                        ]
                    } });
            }
            catch (stepError) {
                yield this.log(`💥 Erro no TaskSuccessStep para tarefa ${task.id}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { successResult: {
                        success: false,
                        error: stepError.message,
                        taskId: task.id
                    }, shouldAbort: true, abortReason: `Falha no tratamento de sucesso: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa executada com sucesso
     * @param {Object} executionResult - Resultado da execução
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static handleSuccess(task, executionResult, userId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new TaskSuccessStep();
            const result = yield step.execute({ task, executionResult, userId });
            return result.successResult;
        });
    }
}
module.exports = TaskSuccessStep;
