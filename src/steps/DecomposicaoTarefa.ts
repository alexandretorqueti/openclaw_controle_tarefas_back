// src/steps/DecomposicaoTarefa.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { createLegacyCallAnalyst } from '../steps/adapters/legacyCallAnalyst';

export const passoDecomposicaoTarefa: Passo = {
    name: 'Decomposição de Tarefa',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, UserId } = ctx;

        if (!tarefaAtual) return;

        await log(`🔍 Tarefa complexa [${tarefaAtual.id}]. Chamando Analista para decomposição...`);
        
        try {
            // Instancia o adaptador legado passando o ID do usuário
            const callAnalyst = createLegacyCallAnalyst(UserId);
            
            // O Analista faz a mágica dele (chamada à API da IA, criação no banco, etc)
            const routingResult = await callAnalyst(tarefaAtual);
            
            // AS MIGALHAS: Anotamos na prancheta o que o Analista conseguiu fazer
            tarefaAtual.analiseConcluidaComSucesso = routingResult?.success || false;
            tarefaAtual.subtasksCreated = routingResult?.subtasksCreated || 0;

            if (tarefaAtual.subtasksCreated > 0) {
                await log(`✅ Tarefa mãe decomposta em ${tarefaAtual.subtasksCreated} subtarefas.`);
            } else {
                await log(`⚠️ Analista foi chamado, mas não conseguiu criar nenhuma subtarefa.`);
            }

        } catch (error: any) {
            await log(`💥 Erro durante a decomposição da tarefa: ${error.message}`);
            // Deixamos a migalha do erro para a esteira saber que deu ruim
            tarefaAtual.erroDecomposicao = true;
        }
    }
};