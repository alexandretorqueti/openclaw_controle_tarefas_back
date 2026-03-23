// src/steps/adapters/legacyCallAnalyst.js
/**
 * Adaptador para manter compatibilidade com a função callAnalyst original.
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
 * Cria a função callAnalyst compatível usando o container
 * @param {string} userId - ID do usuário para comentários
 * @returns {Function} Função callAnalyst(task)
 */
function createLegacyCallAnalyst(userId) {
    // Importar AnalystStep (evita circular dependency)
    const AnalystStep = require('../AnalystStep');
    // Criar instância do step (o construtor já obtém tudo do container)
    const analystStep = new AnalystStep();
    /**
     * Função compatível com a callAnalyst original
     * @param {Object} task - Tarefa a ser analisada
     * @returns {Promise<Object>} { success, subtasksCreated, error? }
     */
    return function callAnalyst(task) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const context = {
                    task,
                    userId
                };
                const result = yield analystStep.execute(context);
                // Retornar formato compatível
                if (result.analysisResult.success) {
                    return {
                        success: true,
                        subtasksCreated: result.analysisResult.subtasksCreated || 0
                    };
                }
                else {
                    return {
                        success: false,
                        error: result.analysisResult.error
                    };
                }
            }
            catch (error) {
                const log = container.resolve('log');
                log(`💥 Erro não tratado em callAnalyst: ${error.message}`);
                return {
                    success: false,
                    error: error.message
                };
            }
        });
    };
}
module.exports = { createLegacyCallAnalyst };
