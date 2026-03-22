// Migrado para TypeScript - Fase: Utils
// Arquivo: pipelineUtils.js

// src/utils/pipelineUtils.js
import { log } from '../../aux/logger';

/**
 * Executa uma série de etapas (pipeline) sequencialmente.
 * @param {string} pipelineName - Nome do pipeline para os logs.
 * @param {Object} initialContext - Estado inicial que será passado para a primeira etapa.
 * @param {Array<Function>} steps - Array de funções assíncronas (etapas).
 * @returns {Promise<Object>} O contexto final após todas as etapas.
 */
async function runPipeline(pipelineName: any, initialContext: any, steps: any): any {
  let currentContext = { ...initialContext };

  await log(`🚀 [PIPELINE START] Iniciando: ${pipelineName}`);

  for (const step of steps) {
    const stepName = step.name || 'UnnamedStep';
    await log(`\n▶️ [STEP IN] ${stepName}`);
    
    // Loga as chaves disponíveis no contexto para facilitar o debug sem poluir o terminal
    await log(`📦 Contexto de Entrada: [${Object.keys(currentContext).join(', ')}]`);

    try {
      // Executa a etapa passando o contexto atual
      currentContext = await step(currentContext);
      
      await log(`✅ [STEP OUT] ${stepName} concluído com sucesso.`);
      
      // Verifica se a etapa pediu para abortar o fluxo
      if (currentContext.abortPipeline) {
        await log(`🛑 [PIPELINE ABORT] A etapa '${stepName}' solicitou interrupção.`);
        await log(`Motivo: ${currentContext.abortReason || 'Não especificado'}`);
        break;
      }
    } catch (error) {
      await log(`❌ [STEP ERROR] Falha crítica na etapa '${stepName}': ${error.message}`);
      throw error; // Repassa o erro para ser tratado no catch global
    }
  }

  await log(`\n🏁 [PIPELINE END] Finalizado: ${pipelineName}\n`);
  return currentContext;
}

export { runPipeline };




export default { runPipeline };