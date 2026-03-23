// src/steps/adapters/legacyTaskTimeoutCheck.js
/**
 * Adaptador para manter compatibilidade com a função handleTaskTimeoutCheck original.
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
 * Cria a função handleTaskTimeoutCheck compatível usando o container
 * @param {number} defaultTaskTimeoutMs - Timeout padrão (ex: TASK_TIMEOUT_MS)
 * @returns {Function} Função handleTaskTimeoutCheck(pid)
 */
function createLegacyTaskTimeoutCheck(defaultTaskTimeoutMs = null) {
    // Importar TaskTimeoutCheckStep (evita circular dependency)
    const TaskTimeoutCheckStep = require('../TaskTimeoutCheckStep');
    /**
     * Função compatível com a handleTaskTimeoutCheck original
     * @param {number} pid - PID do processo a verificar
     * @returns {Promise<void>}
     */
    return function handleTaskTimeoutCheck(pid) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const step = new TaskTimeoutCheckStep();
                yield step.execute({
                    pid,
                    taskTimeoutMs: defaultTaskTimeoutMs
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
 * Aceita a assinatura: handleTaskTimeoutCheck(pid, config)
 * Ignora config, usa timeout do config se fornecido
 */
function handleTaskTimeoutCheck(pid, config = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const step = new (require('../TaskTimeoutCheckStep'))();
            yield step.execute({
                pid,
                taskTimeoutMs: config.TASK_TIMEOUT_MS || null
            });
        }
        catch (stepError) {
            // Erro já foi logado pelo step
        }
    });
}
module.exports = { createLegacyTaskTimeoutCheck, handleTaskTimeoutCheck };
