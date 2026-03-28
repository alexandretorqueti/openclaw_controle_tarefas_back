// src/steps/InicializaTarefa.ts

import axios from 'axios';
import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';

export const passoInicializaTarefa: Passo = {
    name: 'Trava Tarefa e Status',
    func: async (ctx: ContextoExecucao) => {
        // 1. Extraímos o que precisamos do contexto
        const { tarefaAtual, services, config } = ctx;
        const { lockService, stateService } = services;

        // Se por algum motivo bizarro a tarefa não estiver no contexto, ignoramos
        if (!tarefaAtual) return;

        // 2. Tenta adquirir o lock específico para o ID desta tarefa
        const lockAdquirido = await lockService.acquireLock(tarefaAtual.id);
        if (!lockAdquirido) {
            await log(`❌ Falha ao adquirir lock para a tarefa ${tarefaAtual.id}.`);
            return;
        }
        
        // 3. Registra a tarefa como ativa no sistema de arquivos/estado
        await stateService.registerActiveTask(tarefaAtual.id);
        
        // 4. Busca os status disponíveis na API para descobrir o ID do "Em Andamento"
        try {
            const statusResponse = await axios.get(`${config.API_URL}/api/statuses`);
            const inProgressStatus = statusResponse.data?.statuses?.find(
                (s: any) => s.name === config.STATUS.IN_PROGRESS
            );
            
            // 5. Atualiza a tarefa no banco com o novo status
            if (inProgressStatus) {
                await axios.put(`${config.API_URL}/api/tasks/${tarefaAtual.id}`, { 
                    statusId: inProgressStatus.id 
                });
                await log(`✅ Status da tarefa ${tarefaAtual.id} atualizado para "${config.STATUS.IN_PROGRESS}".`);
            } else {
                await log(`⚠️ Status "${config.STATUS.IN_PROGRESS}" não encontrado na API.`);
            }
        } catch (error: any) {
            await log(`⚠️ Erro ao buscar ou atualizar status: ${error.message}`);
            // Nota: Aqui não estamos abortando o ciclo se falhar apenas a atualização visual do status,
            // mas você pode alterar para `ctx.deveAbortarCiclo = true` se for um requisito rigoroso.
        }
    }
};