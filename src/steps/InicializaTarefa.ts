// src/steps/InicializaTarefa.ts

import axios from 'axios';
import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoInicializaTarefa: Passo = {
    // ⚠️ CORREÇÃO CRÍTICA: O nome deve bater exatamente com o workflowMap.ts
    name: 'Inicializa Tarefa', 
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, services, config } = ctx;
        const { lockService, stateService } = services;

        if (!tarefaAtual) return;

        await log(`⚙️ Inicializando ambiente para a tarefa ${tarefaAtual.id}...`);

        // 1. LOCK: Tenta adquirir o lock específico
        const lockAdquirido = await lockService.acquireLock(tarefaAtual.id);
        if (!lockAdquirido) {
            await log(`❌ Tarefa ${tarefaAtual.id} já está em processamento por outro worker.`);
            tarefaAtual.erroInicializacao = true; // Migalha para o Mapa abortar
            return;
        }
        
        // 2. ESTADO: Registra a tarefa como ativa
        await stateService.registerActiveTask(tarefaAtual.id);
        
        // 3. DISCO: Prepara o diretório de trabalho da tarefa (NOVO)
        try {
            const fileSystem = container.resolve('fileSystem');
            const path = container.resolve('path');
            
            // Ex: /tmp/tasks/123
            const taskDir = path.join(config.TASKS_DIR, tarefaAtual.id.toString());
            await fileSystem.mkdir(taskDir, { recursive: true });
            
            tarefaAtual.taskDir = taskDir; // Salva para o OpenClaw saber onde trabalhar
            await log(`📁 Diretório de trabalho isolado criado.`);
        } catch (fsError: any) {
            await log(`⚠️ Erro fatal ao criar diretório de trabalho: ${fsError.message}`);
            tarefaAtual.erroInicializacao = true;
            return; // Sem disco, não dá pra continuar
        }

        // 4. COMUNICAÇÃO: Atualiza o status na API
        try {
            const api = container.resolve('apiService') || axios;
            
            const statusResponse = await api.get(`${config.API_URL}/api/statuses`);
            const inProgressStatus = statusResponse.data?.statuses?.find(
                (s: any) => s.name === config.STATUS?.IN_PROGRESS || s.name === 'Em Andamento'
            );
            
            if (inProgressStatus) {
                await api.put(`${config.API_URL}/api/tasks/${tarefaAtual.id}`, { 
                    statusId: inProgressStatus.id 
                });
                await log(`✅ Status atualizado para "Em Andamento".`);
            } else {
                await log(`⚠️ Status "Em Andamento" não encontrado na API.`);
            }
        } catch (error: any) {
            await log(`⚠️ Erro ao atualizar status na API: ${error.message} (Ignorando...)`);
            // Degradação graciosa: Se só a UI falhar, continuamos o trabalho técnico.
        }
    }
};