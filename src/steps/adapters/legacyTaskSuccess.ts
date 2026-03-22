// Migrado para TypeScript - Fase: Steps
// Arquivo: legacyTaskSuccess.js

// src/steps/adapters/legacyTaskSuccess.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskSuccess original.
 * Usa o container para obter todas as dependências.
 */

import container from '../../container';

/**
 * Cria a função handleTaskSuccess compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskSuccess(task, executionResult)
 */
function createLegacyTaskSuccess(defaultUserId = null, defaultApiUrl = null): any {
  // Importar TaskSuccessStep (evita circular dependency)
  import TaskSuccessStep from '../TaskSuccessStep';
  
  /**
   * Função compatível com a handleTaskSuccess original
   * @param {Object} task - Tarefa executada com sucesso
   * @param {Object} executionResult - Resultado da execução
   * @returns {Promise<void>}
   */
  return async function handleTaskSuccess(task: any, executionResult: any): any {
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

/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskSuccess(task, executionResult, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
async function handleTaskSuccess(task: any, executionResult: any, userId = null, config = {}): any {
  try {
    const step = new (require('../TaskSuccessStep'))();
    await step.execute({
      task,
      executionResult,
      userId: userId || null,
      apiUrl: config.API_URL || null
    });
  } catch (stepError) {
    // Erro já foi logado pelo step
  }
}

export { createLegacyTaskSuccess, handleTaskSuccess };

export default { createLegacyTaskSuccess, handleTaskSuccess };