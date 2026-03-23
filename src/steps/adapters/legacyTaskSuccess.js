// src/steps/adapters/legacyTaskSuccess.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskSuccess original.
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
 * Cria a função handleTaskSuccess compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskSuccess(task, executionResult)
 */
function createLegacyTaskSuccess(defaultUserId = null, defaultApiUrl = null) {
    // Importar TaskSuccessStep (evita circular dependency)
    const TaskSuccessStep = require('../TaskSuccessStep');
    /**
     * Função compatível com a handleTaskSuccess original
     * @param {Object} task - Tarefa executada com sucesso
     * @param {Object} executionResult - Resultado da execução
     * @returns {Promise<void>}
     */
    return function handleTaskSuccess(task, executionResult) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const step = new TaskSuccessStep();
                yield step.execute({
                    task,
                    executionResult,
                    userId: defaultUserId,
                    apiUrl: defaultApiUrl
                });
                // A função original não retorna nada
            }
            catch (stepError) {
                // Erro já foi logado pelo step, não precisamos fazer nada aqui
                // A função original não lança exceções para fora
            }
        });
    };
}
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskSuccess(task, executionResult, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
function handleTaskSuccess(task, executionResult, userId = null, config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const step = new (require('../TaskSuccessStep'))();
            yield step.execute({
                task,
                executionResult,
                userId: userId || null,
                apiUrl: config.API_URL || null
            });
        }
        catch (stepError) {
            // Erro já foi logado pelo step
        }
    });
}
module.exports = { createLegacyTaskSuccess, handleTaskSuccess };
