// src/steps/BuscaTarefa.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { createLegacyGetNextTask } from '../steps/adapters/legacyGetNextTask';

export const passoBuscaTarefa: Passo = {
    name: 'Busca Nova Tarefa',
    func: async (ctx: ContextoExecucao) => {
        // 1. Extraímos as dependências e configurações do contexto
        const { API_URL, MY_USER_NICKNAME } = ctx.config;

        // 2. Instanciamos a função de busca
        const getNextTask = createLegacyGetNextTask(API_URL);
        
        // 3. Executamos a busca
        const tarefa = await getNextTask(MY_USER_NICKNAME);

        // 4. Se a fila estiver vazia, avisamos o pipeline para parar por aqui
        if (!tarefa) {
            return;
        }

        // 5. Se encontrou, injetamos a tarefa no contexto para os PRÓXIMOS passos usarem
        ctx.tarefaAtual = tarefa;

        await log(`🎯 Tarefa capturada: [${tarefa.id}] ${tarefa.title}`);
    }
};