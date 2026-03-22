// Migrado para TypeScript - Fase: Steps
// Arquivo: legacyCallAnalyst.js

// src/steps/adapters/legacyCallAnalyst.js
/**
 * Adaptador para manter compatibilidade com a função callAnalyst original.
 * Usa o container para obter todas as dependências.
 */

import container from '../../container';

/**
 * Cria a função callAnalyst compatível usando o container
 * @param {string} userId - ID do usuário para comentários
 * @returns {Function} Função callAnalyst(task)
 */
function createLegacyCallAnalyst(userId: any): any {
  // Importar AnalystStep (evita circular dependency)
  import AnalystStep from '../AnalystStep';
  
  // Criar instância do step (o construtor já obtém tudo do container)
  const analystStep = new AnalystStep();
  
  /**
   * Função compatível com a callAnalyst original
   * @param {Object} task - Tarefa a ser analisada
   * @returns {Promise<Object>} { success, subtasksCreated, error? }
   */
  return async function callAnalyst(task: any): any {
    try {
      const context = {
        task,
        userId
      };
      
      const result = await analystStep.execute(context);
      
      // Retornar formato compatível
      if (result.analysisResult.success) {
        return {
          success: true,
          subtasksCreated: result.analysisResult.subtasksCreated || 0
        };
      } else {
        return {
          success: false,
          error: result.analysisResult.error
        };
      }
    } catch (error) {
      const log = container.resolve('log');
      log(`💥 Erro não tratado em callAnalyst: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  };
}

export { createLegacyCallAnalyst };

export default { createLegacyCallAnalyst };