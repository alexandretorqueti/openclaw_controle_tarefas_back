// src/steps/VerificacaoDominio.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import { handleTaskFailure as legacyHandleTaskFailure } from '../steps/adapters/legacyTaskFailure';

export const passoVerificacaoDominio: Passo = {
    name: 'Verificação de Domínio',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, UserId, config } = ctx;

        if (!tarefaAtual) return;

        // Se a tarefa não tem um domínio definido, é um erro fatal de negócio.
        if (!tarefaAtual.domain) {
            await log(`❌ Tarefa atômica [${tarefaAtual.id}], mas sem domínio definido (IA não conseguiu inferir).`);
            
            try {
                // Invoca a rotina de falha (move para ERROR_DIR, atualiza API, etc)
                await legacyHandleTaskFailure(
                    tarefaAtual, 
                    new Error(`A tarefa é atômica, mas não foi possível inferir se é FRONTEND ou BACKEND.`), 
                    UserId, 
                    { 
                        API_URL: config.API_URL, 
                        TASKS_DIR: config.TASKS_DIR, 
                        ERROR_DIR: config.ERROR_DIR 
                    }
                );
            } catch (cleanupError: any) {
                await log(`⚠️ Falha na rotina de limpeza do erro de domínio: ${cleanupError.message}`);
            }

            // A MIGALHA VITAL: Anotamos a falha garantidamente para a Esteira saber e ejetar a tarefa
            tarefaAtual.falhaDeDominio = true;
        } else {
            // Se tem domínio, o trabalhador apenas sorri e acena. Tudo certo!
            await log(`✅ Verificação de domínio aprovada: ${tarefaAtual.domain}.`);
        }
    }
};