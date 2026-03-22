// Migrado para TypeScript - Fase: Steps
// Arquivo: legacyExecuteTask.js

// src/steps/adapters/legacyExecuteTask.js
/**
 * Adapter para manter a compatibilidade com a interface antiga
 * do `TaskExecutionService.executeTask` enquanto o sistema é migrado.
 */

import TaskExecutionOrchestrator from '../TaskExecutionOrchestrator';

/**
 * Adapter que atua como substituto transparente para a função `executeTask` original.
 * Ele instancia o TaskExecutionOrchestrator e o executa.
 * 
 * @param {Object} task - A tarefa a ser executada
 * @param {string} userId - O ID do usuário associado (Jarbas)
 * @param {Object} config - Configurações (TASKS_DIR, PROCESSED_DIR, ERROR_DIR, LOCK_FILE, MY_USER_ID, API_URL, TASK_TIMEOUT_MS)
 * @returns {Promise<Object>} Resultado da execução: { success, executionNotes, taskId }
 */
async function legacyExecuteTask(task: any, userId: any, config: any): Promise<any> {
  const orchestrator = new TaskExecutionOrchestrator();
  return await orchestrator.executeTask(task, userId, config);
}

export {
  legacyExecuteTask as executeTask
};

export default {
  executeTask: legacyExecuteTask
};