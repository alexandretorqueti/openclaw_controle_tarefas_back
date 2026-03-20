// src/steps/adapters/legacyTaskSuccess.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskSuccess original.
 * Usa o container para obter todas as dependências.
 */

const container = require('@/bootstrap');

/**
 * Cria a função handleTaskSuccess compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskSuccess(task, executionResult)
 */
function createLegacyTaskSuccess(defaultUserId = null, defaultApiUrl = null) {
  // Importar TaskSuccessStep (evita circular dependency)
  const TaskSuccessStep = require('../TaskSuccessStep');
  
  /**
   * Função compatível com a handleTaskSuccess original
   * @param {Object} task - Tarefa executada com sucesso
   * @param {Object} executionResult - Resultado da execução
   * @returns {Promise<void>}
   */
  return async function handleTaskSuccess(task, executionResult) {
    try {
      const step = new TaskSuccessStep();
      await step.execute({
        task,
        executionResult,
        userId: defaultUserId,
        apiUrl: defaultApiUrl
      });
      // A função original não retorna nada
    } catch (stepError) {
      // Erro já foi logado pelo step, não precisamos fazer nada aqui
      // A função original não lança exceções para fora
    }
  };
}

module.exports = { createLegacyTaskSuccess };