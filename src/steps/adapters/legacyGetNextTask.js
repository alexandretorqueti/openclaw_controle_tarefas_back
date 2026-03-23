// src/steps/adapters/legacyGetNextTask.js
/**
 * Adaptador para manter compatibilidade com a função getNextEligibleTask original.
 * Usa o container para obter todas as dependências.
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
    return function getNextEligibleTask(nickname) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const step = new GetNextTaskStep();
                const result = yield step.execute({
                    nickname,
                    apiUrl: defaultApiUrl
                });
                // Retorna a tarefa ou null (mesma assinatura da função original)
                return result.nextTaskResult.task || null;
            }
            catch (stepError) {
                // A função original retorna null em caso de erro
                // Erro já foi logado pelo step
                return null;
            }
        });
    };
}
module.exports = { createLegacyGetNextTask };
