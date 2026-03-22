// src/steps/adapters/legacyGetNextTask.js
/**
 * Adaptador para manter compatibilidade com a função getNextEligibleTask original.
 * Usa o container para obter todas as dependências.
 */

const container = require('../../container');

/**
 * Cria a função getNextEligibleTask compatível usando o container
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função getNextEligibleTask(nickname)
 */
function createLegacyGetNextTask(defaultApiUrl = null) {
  // Importar GetNextTaskStep (evita circular dependency)
  const GetNextTaskStep = require('../GetNextTaskStep');
  
  /**
   * Função compatível com a getNextEligibleTask original
   * @param {string} nickname - Nickname do usuário
   * @returns {Promise<Object|null>} Tarefa encontrada ou null
   */
  return async function getNextEligibleTask(nickname) {
    try {
      const step = new GetNextTaskStep();
      const result = await step.execute({
        nickname,
        apiUrl: defaultApiUrl
      });
      
      // Retorna a tarefa ou null (mesma assinatura da função original)
      return result.nextTaskResult.task || null;
      
    } catch (stepError) {
      // A função original retorna null em caso de erro
      // Erro já foi logado pelo step
      return null;
    }
  };
}

module.exports = { createLegacyGetNextTask };