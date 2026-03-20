// src/steps/adapters/legacyCallAnalyst.js
/**
 * Adaptador para manter compatibilidade com a função callAnalyst original.
 * Cria uma função com a mesma assinatura usando o AnalystStep com injeção de dependências.
 */

const path = require('path');
const fs = require('fs').promises;

/**
 * Factory que cria a função callAnalyst compatível
 * @param {Object} services - Serviços injetados
 * @param {Object} services.openClawService 
 * @param {Object} services.promptFactory
 * @param {Object} services.sessionChainUtils
 * @param {Object} services.jsonUtils
 * @param {Object} services.taskService
 * @param {Object} services.decompositionService
 * @param {Object} services.commentService
 * @param {Function} services.log - Função de logging
 * @param {Object} config - Configurações { TASKS_DIR, TASK_TIMEOUT_TS }
 * @param {string} userId - ID do usuário para comentários
 * @returns {Function} Função callAnalyst(task)
 */
function createLegacyCallAnalyst(services, config, userId) {
  const {
    openClawService,
    promptFactory,
    sessionChainUtils,
    jsonUtils,
    taskService,
    decompositionService,
    commentService,
    log
  } = services;
  
  // Importar AnalystStep (evita circular dependency)
  const AnalystStep = require('../AnalystStep');
  
  // Criar instância do step com todas as dependências
  const analystStep = new AnalystStep({
    openClawService,
    promptFactory,
    sessionChainUtils,
    jsonUtils,
    taskService,
    decompositionService,
    commentService,
    log,
    config,
    fileSystem: fs  // Usar fs.promises real
  });
  
  /**
   * Função compatível com a callAnalyst original
   * @param {Object} task - Tarefa a ser analisada
   * @returns {Promise<Object>} { success, subtasksCreated, error? }
   */
  return async function callAnalyst(task) {
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
      log(`💥 Erro não tratado em callAnalyst: ${error.message}`);
      return {
        success: false,
        error: error.message
      };
    }
  };
}

module.exports = { createLegacyCallAnalyst };