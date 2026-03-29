"use strict";
// src/steps/DecomposicaoTarefa.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoDecomposicaoTarefa = void 0;
const logger_1 = require("../aux/logger");
const legacyCallAnalyst_1 = require("../steps/adapters/legacyCallAnalyst");
exports.passoDecomposicaoTarefa = {
    name: 'Decomposição de Tarefa',
    func: async (ctx) => {
        const { tarefaAtual, UserId } = ctx;
        if (!tarefaAtual)
            return;
        await (0, logger_1.log)(`🔍 Tarefa complexa [${tarefaAtual.id}]. Chamando Analista para decomposição...`);
        try {
            // Instancia o adaptador legado passando o ID do usuário
            const callAnalyst = (0, legacyCallAnalyst_1.createLegacyCallAnalyst)(UserId);
            // O Analista faz a mágica dele (chamada à API da IA, criação no banco, etc)
            const routingResult = await callAnalyst(tarefaAtual);
            // AS MIGALHAS: Anotamos na prancheta o que o Analista conseguiu fazer
            tarefaAtual.analiseConcluidaComSucesso = routingResult?.success || false;
            tarefaAtual.subtasksCreated = routingResult?.subtasksCreated || 0;
            if (tarefaAtual.subtasksCreated > 0) {
                await (0, logger_1.log)(`✅ Tarefa mãe decomposta em ${tarefaAtual.subtasksCreated} subtarefas.`);
            }
            else {
                await (0, logger_1.log)(`⚠️ Analista foi chamado, mas não conseguiu criar nenhuma subtarefa.`);
            }
        }
        catch (error) {
            await (0, logger_1.log)(`💥 Erro durante a decomposição da tarefa: ${error.message}`);
            // Deixamos a migalha do erro para a esteira saber que deu ruim
            tarefaAtual.erroDecomposicao = true;
        }
    }
};
