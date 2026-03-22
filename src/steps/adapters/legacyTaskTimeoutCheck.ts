// Migrado para TypeScript - Fase: Steps
// Arquivo: legacyTaskTimeoutCheck.js

// src/steps/adapters/legacyTaskTimeoutCheck.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskTimeoutCheck original.
 * Usa o container para obter todas as dependências.
 */

import container from '../../container';

/**
 * Cria a função handleTaskTimeoutCheck compatível usando o container
 * @param {number} defaultTaskTimeoutMs - Timeout padrão (ex: TASK_TIMEOUT_MS)
 * @returns {Function} Função handleTaskTimeoutCheck(pid)
 */
function createLegacyTaskTimeoutCheck(defaultTaskTimeoutMs = null): any {
  // Importar TaskTimeoutCheckStep (evita circular dependency)
  import TaskTimeoutCheckStep from '../TaskTimeoutCheckStep';
  
  /**
   * Função compatível com a handleTaskTimeoutCheck original
   * @param {number} pid - PID do processo a verificar
   * @returns {Promise<void>}
   */
  return async function handleTaskTimeoutCheck(pid: any): any {
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

/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskTimeoutCheck(pid, config)
 * Ignora config, usa timeout do config se fornecido
 */
async function handleTaskTimeoutCheck(pid: any, config = {}): any {
  try {
    const step = new (require('../TaskTimeoutCheckStep'))();
    await step.execute({
      pid,
      taskTimeoutMs: config.TASK_TIMEOUT_MS || null
    });
  } catch (stepError) {
    // Erro já foi logado pelo step
  }
}

export { createLegacyTaskTimeoutCheck, handleTaskTimeoutCheck };

export default { createLegacyTaskTimeoutCheck, handleTaskTimeoutCheck };