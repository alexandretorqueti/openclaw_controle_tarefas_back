// src/services/monitorStateService.js
// Servico de gerenciamento de estado do monitor
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require('fs').promises;
const path = require('path');
const { fileExists, safeReadFile, safeWriteFile } = require('../utils/fileUtils');
const { safeParse, safeStringify } = require('../utils/jsonUtils');
class MonitorStateService {
    constructor(tasksDir) {
        this.tasksDir = tasksDir;
        this.stateFilePath = path.join(tasksDir, 'monitor-state.json');
    }
    /**
     * Le o estado atual do monitor
     * @returns {Promise<Object>}
     */
    readState() {
        return __awaiter(this, void 0, void 0, function* () {
            const content = yield safeReadFile(this.stateFilePath);
            if (!content) {
                return { active_tasks: {} };
            }
            const state = safeParse(content, { active_tasks: {} });
            if (!state.active_tasks) {
                state.active_tasks = {};
            }
            return state;
        });
    }
    /**
     * Salva o estado do monitor
     * @param {Object} state - Estado a salvar
     * @returns {Promise<boolean>}
     */
    saveState(state) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield safeWriteFile(this.stateFilePath, safeStringify(state));
        });
    }
    /**
     * Registra uma tarefa como ativa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<void>}
     */
    registerActiveTask(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.readState();
            state.active_tasks[taskId] = { startTime: Date.now() };
            yield this.saveState(state);
        });
    }
    /**
     * Remove uma tarefa do estado ativo
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<void>}
     */
    cleanupTask(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.readState();
            if (state.active_tasks && state.active_tasks[taskId]) {
                delete state.active_tasks[taskId];
                yield this.saveState(state);
            }
        });
    }
    /**
     * Obtem informacoes de uma tarefa ativa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<Object|null>}
     */
    getActiveTask(taskId) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.readState();
            return ((_a = state.active_tasks) === null || _a === void 0 ? void 0 : _a[taskId]) || null;
        });
    }
    /**
     * Obtem todas as tarefas ativas
     * @returns {Promise<Object>}
     */
    getActiveTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            const state = yield this.readState();
            return state.active_tasks || {};
        });
    }
    /**
     * Obtem o tempo de execucao de uma tarefa
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<number|null>} Tempo em ms
     */
    getTaskElapsedTime(taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            const task = yield this.getActiveTask(taskId);
            if (!task || !task.startTime) {
                return null;
            }
            return Date.now() - task.startTime;
        });
    }
    /**
     * Verifica se uma tarefa esta em timeout
     * @param {string} taskId - ID da tarefa
     * @param {number} timeoutMs - Tempo limite em ms
     * @returns {Promise<boolean>}
     */
    isTaskTimedOut(taskId, timeoutMs) {
        return __awaiter(this, void 0, void 0, function* () {
            const elapsed = yield this.getTaskElapsedTime(taskId);
            return elapsed !== null && elapsed > timeoutMs;
        });
    }
    /**
     * Limpa completamente o estado
     * @returns {Promise<void>}
     */
    clearState() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                if (yield fileExists(this.stateFilePath)) {
                    yield fs.unlink(this.stateFilePath);
                }
            }
            catch (error) {
                // Silenciosamente ignora erros ao limpar estado
            }
        });
    }
}
module.exports = MonitorStateService;
