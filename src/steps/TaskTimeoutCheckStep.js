// src/steps/TaskTimeoutCheckStep.js
/**
 * Step responsável por verificar timeout de tarefas em execução.
 * Mata processos que excederam o limite crítico e limpa o sistema.
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
class TaskTimeoutCheckStep {
    /**
     * Construtor que obtém dependências do container.
     * Aceita instâncias opcionais para facilitar testes.
     */
    constructor(options = {}) {
        this.log = container.resolve('log');
        this.config = container.resolve('config');
        this.timeUtils = container.resolve('timeUtils');
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
     * Executa o step de verificação de timeout
     * @param {Object} context - Contexto do pipeline
     * @param {number} context.pid - PID do processo a verificar
     * @param {number} context.taskTimeoutMs - Timeout da tarefa em ms (opcional, usa config.TASK_TIMEOUT_MS por padrão)
     * @returns {Promise<Object>} Contexto atualizado com resultado
     */
    execute(context) {
        return __awaiter(this, void 0, void 0, function* () {
            const { pid } = context;
            const taskTimeoutMs = context.taskTimeoutMs || this.config.TASK_TIMEOUT_MS;
            const { TASKS_DIR, ERROR_DIR } = this.config;
            if (!pid) {
                yield this.log(`⚠️ TaskTimeoutCheckStep: pid não fornecido`);
                return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                        success: false,
                        error: 'pid não fornecido'
                    } });
            }
            try {
                // 1. Obtém tarefas ativas
                const activeTasks = yield this.stateService.getActiveTasks();
                const taskIds = Object.keys(activeTasks);
                if (taskIds.length === 0) {
                    yield this.log(`ℹ️ Nenhuma tarefa ativa para verificar timeout`);
                    return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                            success: true,
                            action: 'no_active_tasks',
                            message: 'Nenhuma tarefa ativa para verificar'
                        } });
                }
                const now = Date.now();
                const taskId = taskIds[0];
                const task = activeTasks[taskId];
                const elapsed = now - task.startTime;
                const GRACE_PERIOD_MS = 60000; // 1 minuto de carência após o timeout
                yield this.log(`⏱️ Tarefa ${taskId} em execução por ${this.timeUtils.segundosToMinutos_Segundos(elapsed / 1000)}.`);
                // 2. Verifica se excedeu o limite crítico (timeout + grace period)
                if (elapsed > taskTimeoutMs + GRACE_PERIOD_MS) {
                    yield this.log(`💀 CEIFADOR: Tarefa ${taskId} excedeu o limite crítico (Timeout + 1m).`);
                    yield this.log(`⚰️ Encerrando processo ${pid}, desbloqueando sistema e movendo arquivos para ERROR.`);
                    // Mata o processo e remove o arquivo de lock
                    yield this.lockService.killAndRelease(pid);
                    // Move arquivos para a pasta de erro
                    yield this.taskFileService.moveTaskFiles(taskId, TASKS_DIR, ERROR_DIR);
                    // Limpa o estado interno
                    yield this.stateService.cleanupTask(taskId);
                    yield this.log(`🧹 Sistema recuperado. O próximo ciclo poderá assumir a fila.`);
                    return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                            success: true,
                            action: 'killed_and_cleaned',
                            taskId,
                            pid,
                            elapsedMs: elapsed,
                            exceededByMs: elapsed - (taskTimeoutMs + GRACE_PERIOD_MS),
                            actionsTaken: ['killed_process', 'released_lock', 'moved_files', 'cleaned_state']
                        } });
                }
                // 3. Verifica se excedeu apenas o timeout original (mas ainda está na grace period)
                else if (elapsed > taskTimeoutMs) {
                    yield this.log(`⚠️ ALERTA: Tarefa ${taskId} excedeu o tempo limite original. Aguardando carência de 1 minuto antes de intervir.`);
                    return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                            success: true,
                            action: 'warning_only',
                            taskId,
                            pid,
                            elapsedMs: elapsed,
                            remainingGraceMs: (taskTimeoutMs + GRACE_PERIOD_MS) - elapsed,
                            message: 'Tarefa excedeu timeout, mas ainda está no período de carência'
                        } });
                }
                // 4. Tarefa ainda dentro do timeout
                else {
                    yield this.log(`✅ Tarefa ${taskId} dentro do tempo limite.`);
                    return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                            success: true,
                            action: 'within_timeout',
                            taskId,
                            pid,
                            elapsedMs: elapsed,
                            remainingMs: taskTimeoutMs - elapsed
                        } });
                }
            }
            catch (stepError) {
                yield this.log(`💥 Erro no TaskTimeoutCheckStep para PID ${pid}: ${stepError.message}`);
                return Object.assign(Object.assign({}, context), { timeoutCheckResult: {
                        success: false,
                        error: stepError.message,
                        pid
                    }, shouldAbort: true, abortReason: `Falha na verificação de timeout: ${stepError.message}` });
            }
        });
    }
    /**
     * Método estático de conveniência para uso direto
     * @param {number} pid - PID do processo a verificar
     * @param {number} taskTimeoutMs - Timeout da tarefa em ms (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static checkTimeout(pid, taskTimeoutMs = null) {
        return __awaiter(this, void 0, void 0, function* () {
            const step = new TaskTimeoutCheckStep();
            const result = yield step.execute({ pid, taskTimeoutMs });
            return result.timeoutCheckResult;
        });
    }
}
module.exports = TaskTimeoutCheckStep;
