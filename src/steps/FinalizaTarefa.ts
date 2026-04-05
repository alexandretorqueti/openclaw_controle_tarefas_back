// src/steps/FinalizaTarefa.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor_old";
import { log } from '../aux/logger';
import container from '../container';

export const passoFinalizaTarefa: Passo = {
    name: 'Finaliza Tarefa',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, UserId, config, controleExecucao } = ctx;
        if (!tarefaAtual) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');
        const taskService = container.resolve('taskService');

        await log(`🏁 Finalizando tarefa ${tarefaAtual.id}...`);

        try {
            // 1. LIMPEZA: Deleta o arquivo .done para não poluir o repositório final
            if (controleExecucao.actualDonePath) {
                await fileSystem.unlink(controleExecucao.actualDonePath).catch(() => {});
            }

            // 2. COMUNICAÇÃO: Atualiza a API ANTES de mover os arquivos! (Segurança de Estado)
            await taskService.updateTask(tarefaAtual.id, { 
                status: 'COMPLETED',
                completedBy: UserId,
                completedAt: new Date().toISOString()
            });
            await log(`✅ Tarefa ${tarefaAtual.id} marcada como CONCLUÍDA na API.`);

            // 3. ORGANIZAÇÃO: Só movemos a pasta se a API confirmou o recebimento
            const sourceDir = path.join(config.TASKS_DIR, tarefaAtual.id.toString());
            const destDir = path.join(config.PROCESSED_DIR, tarefaAtual.id.toString());

            // Garante que a pasta de destino existe e move
            await fileSystem.mkdir(config.PROCESSED_DIR, { recursive: true }).catch(() => {});
            await fileSystem.rename(sourceDir, destDir);
            
            await log(`📁 Arquivos da tarefa arquivados em 'processed'.`);

            // 4. MIGALHA DE SUCESSO ABSOLUTO
            controleExecucao.finalizadaComSucesso = true;

        } catch (error: any) {
            await log(`⚠️ Erro durante a finalização da tarefa: ${error.message}`);
            // Deixa a migalha de erro para auditoria
            controleExecucao.erroFinalizacao = true;
        }
    }
};