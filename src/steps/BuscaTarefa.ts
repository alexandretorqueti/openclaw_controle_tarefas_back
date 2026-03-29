// src/steps/BuscaTarefa.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { createLegacyGetNextTask } from '../steps/adapters/legacyGetNextTask';

export const passoBuscaTarefa: Passo = {
    name: 'Busca Tarefa', // Nome exato como está no workflowMap!
    func: async (ctx: ContextoExecucao) => {
        const { API_URL, MY_USER_NICKNAME } = ctx.config;

        try {
            // 1. Instanciamos a função de busca
            const getNextTask = createLegacyGetNextTask(API_URL);
            
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
            ctx.project = tarefa.project;
            await log(`🎯 Tarefa capturada: [${tarefa.id}] ${tarefa.title}`);

        } catch (error: any) {
            // Se a API cair ou der timeout, a gente loga e aborta o ciclo graciosamente
            await log(`⚠️ Falha na comunicação ao buscar tarefa: ${error.message}`);
            ctx.tarefaAtual = null; 
        }
    }
};