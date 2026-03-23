declare const log: any;
/**
 * Executa uma série de etapas (pipeline) sequencialmente.
 * @param {string} pipelineName - Nome do pipeline para os logs.
 * @param {Object} initialContext - Estado inicial que será passado para a primeira etapa.
 * @param {Array<Function>} steps - Array de funções assíncronas (etapas).
 * @returns {Promise<Object>} O contexto final após todas as etapas.
 */
declare function runPipeline(pipelineName: any, initialContext: any, steps: any): Promise<any>;
