"use strict";
// src/steps/BuscaTarefa.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoBuscaTarefa = void 0;
const logger_1 = require("../aux/logger");
const legacyGetNextTask_1 = require("../steps/adapters/legacyGetNextTask");
exports.passoBuscaTarefa = {
    name: 'Busca Tarefa',
    func: async (ctx) => {
        const { API_URL, MY_USER_NICKNAME } = ctx.config;
        try {
            // 1. Instanciamos a função de busca
            const getNextTask = (0, legacyGetNextTask_1.createLegacyGetNextTask)(API_URL);
            // 2. Executamos a busca
            const tarefa = await getNextTask(MY_USER_NICKNAME);
            // 3. Validação de Fila Vazia
            if (!tarefa) {
                // Garantimos que seja null para o Mapa encerrar o ciclo silenciosamente
                ctx.tarefaAtual = null;
                return;
            }
            // 4. Sucesso: injetamos a tarefa no contexto
            ctx.tarefaAtual = tarefa;
            await (0, logger_1.log)(`🎯 Tarefa capturada: [${tarefa.id}] ${tarefa.title}`);
        }
        catch (error) {
            // Se a API cair ou der timeout, a gente loga e aborta o ciclo graciosamente
            await (0, logger_1.log)(`⚠️ Falha na comunicação ao buscar tarefa: ${error.message}`);
            ctx.tarefaAtual = null;
        }
    }
};
