var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// src/utils/pipelineUtils.js
const { log } = require('../../aux/logger');
/**
 * Executa uma série de etapas (pipeline) sequencialmente.
 * @param {string} pipelineName - Nome do pipeline para os logs.
 * @param {Object} initialContext - Estado inicial que será passado para a primeira etapa.
 * @param {Array<Function>} steps - Array de funções assíncronas (etapas).
 * @returns {Promise<Object>} O contexto final após todas as etapas.
 */
function runPipeline(pipelineName, initialContext, steps) {
    return __awaiter(this, void 0, void 0, function* () {
        let currentContext = Object.assign({}, initialContext);
        yield log(`🚀 [PIPELINE START] Iniciando: ${pipelineName}`);
        for (const step of steps) {
            const stepName = step.name || 'UnnamedStep';
            yield log(`\n▶️ [STEP IN] ${stepName}`);
            // Loga as chaves disponíveis no contexto para facilitar o debug sem poluir o terminal
            yield log(`📦 Contexto de Entrada: [${Object.keys(currentContext).join(', ')}]`);
            try {
                // Executa a etapa passando o contexto atual
                currentContext = yield step(currentContext);
                yield log(`✅ [STEP OUT] ${stepName} concluído com sucesso.`);
                // Verifica se a etapa pediu para abortar o fluxo
                if (currentContext.abortPipeline) {
                    yield log(`🛑 [PIPELINE ABORT] A etapa '${stepName}' solicitou interrupção.`);
                    yield log(`Motivo: ${currentContext.abortReason || 'Não especificado'}`);
                    break;
                }
            }
            catch (error) {
                yield log(`❌ [STEP ERROR] Falha crítica na etapa '${stepName}': ${error.message}`);
                throw error; // Repassa o erro para ser tratado no catch global
            }
        }
        yield log(`\n🏁 [PIPELINE END] Finalizado: ${pipelineName}\n`);
        return currentContext;
    });
}
module.exports = { runPipeline };
