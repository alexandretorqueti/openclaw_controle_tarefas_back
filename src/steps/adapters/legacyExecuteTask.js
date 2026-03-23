// src/steps/adapters/legacyExecuteTask.js
/**
 * Adapter para manter a compatibilidade com a interface antiga
 * do `TaskExecutionService.executeTask` enquanto o sistema é migrado.
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
const TaskExecutionOrchestrator = require('../TaskExecutionOrchestrator');
/**
 * Adapter que atua como substituto transparente para a função `executeTask` original.
 * Ele instancia o TaskExecutionOrchestrator e o executa.
 *
 * @param {Object} task - A tarefa a ser executada
 * @param {string} userId - O ID do usuário associado (Jarbas)
 * @param {Object} config - Configurações (TASKS_DIR, PROCESSED_DIR, ERROR_DIR, LOCK_FILE, MY_USER_ID, API_URL, TASK_TIMEOUT_MS)
 * @returns {Promise<Object>} Resultado da execução: { success, executionNotes, taskId }
 */
function legacyExecuteTask(task, userId, config) {
    return __awaiter(this, void 0, void 0, function* () {
        const orchestrator = new TaskExecutionOrchestrator();
        return yield orchestrator.executeTask(task, userId, config);
    });
}
module.exports = {
    executeTask: legacyExecuteTask
};
