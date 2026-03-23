// src/steps/TaskFailureStep.js
/**
 * Step responsável por tratar falhas na execução de tarefas.
 * Inclui logging, comentários, reatribuição, limpeza de locks e movimentação de arquivos.
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
class TaskFailureStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = container.resolve('log');
        this.config = container.resolve('config');
        this.axios = container.resolve('axios');
        this.path = container.resolve('path');
        this.fileUtils = container.resolve('fileUtils');
        this.fileSystem = container.resolve('fileSystem');
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
     * Executa o step de tratamento de falha
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa que falhou
     * @param {Error} context.error - Erro que ocorreu
     * @param {string} context.userId - ID do usuário (opcional)
     * @param {string} context.apiUrl - URL da API (opcional, usa config.API_URL por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { task, error } = context;
            const userId = context.userId || null;
            const apiUrl = context.apiUrl || this.config.API_URL;
            const { TASKS_DIR, ERROR_DIR } = this.config;
            if (!task || !error) {
                yield this.log(`⚠️ TaskFailureStep: task ou error não fornecidos`);
                return Object.assign(Object.assign({}, context), { failureResult: {
                        success: false,
                        error: 'task ou error não fornecidos'
                    } });
            }
            try {
                yield this.log(`⚠️ ALERTA: Falha na execução da tarefa ${task.id}: ${error.message}`);
                // 1. Ler log do terminal se existir
                const terminalLogPath = this.path.join(TASKS_DIR, `terminal-${task.id}.log`);
                let terminalOutput = "";
                if (yield this.fileUtils.fileExists(terminalLogPath)) {
                    terminalOutput = yield this.fileSystem.readFile(terminalLogPath, 'utf8');
                }
                // 2. Adicionar comentário sobre a falha se tivermos userId
                if (userId) {
                    try {
                        yield this.axios.post(`${apiUrl}/api/comments`, {
                            taskId: task.id,
                            userId,
                            content: `⚠️ **FALHA DE EXECUÇÃO LOCAL**\nErro: ${error.message}\n\nSaída do Terminal:\n${terminalOutput.substring(0, 1000)}`
                        });
                    }
                    catch (commentError) {
                        yield this.log(`❌ Erro ao postar comentário de falha: ${commentError.message}`);
                    }
                }
                // 3. Tentar reatribuir para o desenvolvedor 'alexandre'
                yield this._tryReassignTask(task, apiUrl);
                // 4. Liberar lock e limpar estado de execução
                yield this._cleanupExecutionState(task);
                // 5. Mover arquivos para pasta de erro
                yield this.taskFileService.moveTaskFiles(task.id, TASKS_DIR, ERROR_DIR);
                // 6. Limpar estado interno
                yield this.stateService.cleanupTask(task.id);
                yield this.log(`✅ Falha da tarefa ${task.id} tratada com sucesso`);
                return Object.assign(Object.assign({}, context), { failureResult: {
                        success: true,
                        taskId: task.id,
                        actionsTaken: [
                            'logged',
                            'commented',
                            'reassigned',
                            'lockReleased',
                            'filesMoved',
                            'stateCleaned'
                        ]
                    } });
            }
            catch (stepError) {
                yield this.log(`💥 Erro no TaskFailureStep para tarefa ${task.id}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { failureResult: {
                        success: false,
                        error: stepError.message,
                        taskId: task.id
                    }, shouldAbort: true, abortReason: `Falha no tratamento de erro: ${stepError.message}` });
            }
        });
    }
    /**
     * Tenta reatribuir tarefa para o usuário 'alexandre'
     * @private
     */
    _tryReassignTask(task, apiUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const usersRes = yield this.axios.get(`${apiUrl}/api/users`);
                const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
                if (dev) {
                    yield this.log(`👤 Reatribuindo tarefa ${task.id} para o usuário alexandre.`);
                    yield this.axios.put(`${apiUrl}/api/tasks/${task.id}`, { assignedToId: dev.id });
                }
                else {
                    yield this.log(`⚠️ Usuário 'alexandre' não encontrado na API`);
                }
            }
            catch (assignError) {
                yield this.log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
            }
        });
    }
    /**
     * Libera lock e limpa estado de execução
     * @private
     */
    _cleanupExecutionState(task) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Usar lockService.releaseLock() em vez da rota depreciada
                yield this.lockService.releaseLock();
                yield this.log(`🔓 Tarefa "${task.title}" desmarcada após erro (isExecuting: false)`);
            }
            catch (cleanupError) {
                yield this.log(`❌ Erro ao limpar estado de execução: ${cleanupError.message}`);
                // Fallback: tentar a rota depreciada
                try {
                    const apiUrl = this.config.API_URL;
                    yield this.axios.put(`${apiUrl}/api/tasks/${task.id}/finish-execution`);
                    yield this.log(`⚠️ Usando fallback para finish-execution`);
                }
                catch (fallbackError) {
                    yield this.log(`❌ Fallback também falhou: ${fallbackError.message}`);
                }
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {Object} task - Tarefa que falhou
     * @param {Error} error - Erro que ocorreu
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static handleFailure(task, error, userId = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new TaskFailureStep();
            const result = yield step.execute({ task, error, userId });
            return result.failureResult;
        });
    }
}
module.exports = TaskFailureStep;
