"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoVerificacaoDominio = void 0;
const logger_1 = require("../aux/logger");
const legacyTaskFailure_1 = require("../steps/adapters/legacyTaskFailure");
exports.passoVerificacaoDominio = {
    name: 'Verificação de Domínio',
    func: async (ctx) => {
        const { tarefaAtual, UserId, config, controleExecucao } = ctx;
        if (!tarefaAtual)
            return;
        // Se a tarefa não tem um domínio definido, é um erro fatal de negócio.
        if (!tarefaAtual.domain) {
            await (0, logger_1.log)(`❌ Tarefa atômica [${tarefaAtual.id}], mas sem domínio definido (IA não conseguiu inferir).`);
            try {
                // Invoca a rotina de falha (move para ERROR_DIR, atualiza API, etc)
                await (0, legacyTaskFailure_1.handleTaskFailure)(tarefaAtual, new Error(`A tarefa é atômica, mas não foi possível inferir se é FRONTEND ou BACKEND.`), UserId, {
                    API_URL: config.API_URL,
                    TASKS_DIR: config.TASKS_DIR,
                    ERROR_DIR: config.ERROR_DIR
                });
            }
            catch (cleanupError) {
                await (0, logger_1.log)(`⚠️ Falha na rotina de limpeza do erro de domínio: ${cleanupError.message}`);
            }
            // A MIGALHA VITAL: Anotamos a falha garantidamente para a Esteira saber e ejetar a tarefa
            controleExecucao.falhaDeDominio = true;
        }
        else {
            // Se tem domínio, o trabalhador apenas sorri e acena. Tudo certo!
            await (0, logger_1.log)(`✅ Verificação de domínio aprovada: ${tarefaAtual.domain}.`);
        }
    }
};
