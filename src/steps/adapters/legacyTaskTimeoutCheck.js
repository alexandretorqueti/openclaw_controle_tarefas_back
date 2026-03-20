// src/steps/adapters/legacyTaskTimeoutCheck.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskTimeoutCheck original.
 * Usa o container para obter todas as dependências.
 */

const container = require('@/bootstrap');

/**
 * Cria a função handleTaskTimeoutCheck compatível usando o container
 * @param {number} defaultTaskTimeoutMs - Timeout padrão (ex: TASK_TIMEOUT_MS)
 * @returns {Function} Função handleTaskTimeoutCheck(pid)
 */
function createLegacyTaskTimeoutCheck(defaultTaskTimeoutMs = null) {
  // Importar TaskTimeoutCheckStep (evita circular dependency)
  const TaskTimeoutCheckStep = require('../TaskTimeoutCheckStep');
  
  /**
   * Função compatível com a handleTaskTimeoutCheck original
   * @param {number} pid - PID do processo a verificar
   * @returns {Promise<void>}
   */
  return async function handleTaskTimeoutCheck(pid) {
    try {
      const step = new TaskTimeoutCheckStep();
      await step.execute({
        pid,
        taskTimeoutMs: defaultTaskTimeoutMs
      });
      // A função original não retorna nada
    } catch (stepError) {
      // Erro já foi logado pelo step, não precisamos fazer nada aqui
      // A função original não lança exceções para fora
    }
  };
}

module.exports = { createLegacyTaskTimeoutCheck };