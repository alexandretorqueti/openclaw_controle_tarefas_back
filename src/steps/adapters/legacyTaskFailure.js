// src/steps/adapters/legacyTaskFailure.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskFailure original.
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
 * Cria a função handleTaskFailure compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskFailure(task, error)
 */
function createLegacyTaskFailure(defaultUserId = null, defaultApiUrl = null) {
    // Importar TaskFailureStep (evita circular dependency)
    const TaskFailureStep = require('../TaskFailureStep');
    /**
     * Função compatível com a handleTaskFailure original
     * @param {Object} task - Tarefa que falhou
     * @param {Error} error - Erro que ocorreu
     * @returns {Promise<void>}
     */
    return function handleTaskFailure(task, error) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const step = new TaskFailureStep();
                yield step.execute({
                    task,
                    error,
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
 * Aceita a assinatura: handleTaskFailure(task, error, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
function handleTaskFailure(task, error, userId = null, config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const step = new (require('../TaskFailureStep'))();
            yield step.execute({
                task,
                error,
                userId: userId || null,
                apiUrl: config.API_URL || null
            });
        }
        catch (stepError) {
            // Erro já foi logado pelo step
        }
    });
}
module.exports = { createLegacyTaskFailure, handleTaskFailure };
