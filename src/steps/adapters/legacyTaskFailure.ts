// Migrado para TypeScript - Fase: Steps
// Arquivo: legacyTaskFailure.js

// src/steps/adapters/legacyTaskFailure.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskFailure original.
 * Usa o container para obter todas as dependências.
 */

import container from '../../container';

/**
 * Cria a função handleTaskFailure compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskFailure(task, error)
 */
function createLegacyTaskFailure(defaultUserId = null, defaultApiUrl = null): any {
  // Importar TaskFailureStep (evita circular dependency)
  import TaskFailureStep from '../TaskFailureStep';
  
  /**
   * Função compatível com a handleTaskFailure original
   * @param {Object} task - Tarefa que falhou
   * @param {Error} error - Erro que ocorreu
   * @returns {Promise<void>}
   */
  return async function handleTaskFailure(task: any, error: any): any {
    try {
      const step = new TaskFailureStep();
      await step.execute({
        task,
        error,
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
 * Aceita a assinatura: handleTaskFailure(task, error, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
async function handleTaskFailure(task: any, error: any, userId = null, config = {}): any {
  try {
    const step = new (require('../TaskFailureStep'))();
    await step.execute({
      task,
      error,
      userId: userId || null,
      apiUrl: config.API_URL || null
    });
  } catch (stepError) {
    // Erro já foi logado pelo step
  }
}

export { createLegacyTaskFailure, handleTaskFailure };

export default { createLegacyTaskFailure, handleTaskFailure };