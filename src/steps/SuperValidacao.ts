// src/steps/SuperValidacao.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';
import { handleTaskFailure as legacyHandleTaskFailure } from '../steps/adapters/legacyTaskFailure';

export const passoSuperValidacao: Passo = {
    name: 'Super Validação',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, UserId, config } = ctx;

        if (!tarefaAtual) return;

        // Resolve os serviços pelo Container de DI
        const validationService = container.resolve('validationService');
        const taskService = container.resolve('taskService');

        // Só aciona a IA se a tarefa for complexa ou não tiver domínio
        if (tarefaAtual.isAtomic !== true || !tarefaAtual.domain) {
            await log(`⚖️ Verificando complexidade e/ou inferindo domínio da tarefa [${tarefaAtual.id}]...`);
            
            try {
                // Chama o serviço de IA (agora via container)
                const validation = await validationService.validateWithAuxModel(tarefaAtual, tarefaAtual.project);
                
                if (!validation) throw new Error("A IA de validação retornou um resultado vazio.");

                // Atualiza o objeto da tarefa na memória (As Migalhas!)
                tarefaAtual.isAtomic = validation.isAtomic;
                
                if (!tarefaAtual.domain && validation.domain) {
                    tarefaAtual.domain = validation.domain;
                    await log(`🎯 Domínio inferido pela IA: ${tarefaAtual.domain}`);
                }

                // Salva no banco de dados para persistir as descobertas
                await taskService.updateTask(tarefaAtual.id, { 
                    isAtomic: tarefaAtual.isAtomic,
                    domain: tarefaAtual.domain
                });
                
                await log(`✅ Validação concluída: Atômica? ${tarefaAtual.isAtomic} | Domínio: ${tarefaAtual.domain || 'N/A'}`);
                
            } catch (validationError: any) {
                await log(`💥 Erro na super-validação: ${validationError.message}`);
                
                try {
                    // Tenta fazer o clean-up legado (mover para a pasta de erro, etc)
                    await legacyHandleTaskFailure(tarefaAtual, validationError, UserId, { 
                        API_URL: config.API_URL, 
                        TASKS_DIR: config.TASKS_DIR, 
                        ERROR_DIR: config.ERROR_DIR 
                    });
                } catch (cleanupError: any) {
                    await log(`⚠️ Falha ao executar limpeza no erro de validação: ${cleanupError.message}`);
                }
                
                // A MIGALHA NEGATIVA FATAL: Avisamos na prancheta que a validação falhou e o fluxo deve morrer
                tarefaAtual.erroValidacao = true;
            }
        } else {
            await log(`⏩ Tarefa ${tarefaAtual.id} já é atômica e possui domínio (${tarefaAtual.domain}). Pulando validação com IA.`);
        }
    }
};