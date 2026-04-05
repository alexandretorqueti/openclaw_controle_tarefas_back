// src/steps/InspecionaWorkspace.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor_old";
import { log } from '../aux/logger';
import container from '../container';

export const passoInspecionaWorkspace: Passo = {
    name: 'Inspeciona Workspace',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config, controleExecucao, initialSnapshot } = ctx;
        if (!tarefaAtual) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');
        const workspaceSnapshotService = container.resolve('workspaceSnapshotService');
        const evidenceService = container.resolve('evidenceService');

        await log(`🔍 Inspecionando cena do crime no workspace da tarefa ${tarefaAtual.id}...`);

        // 1. VERIFICAÇÃO DE .DONE (A Arma do Crime)
        const buscarDone = async (dir: string | undefined) => {
            if (!dir) return null;
            try {
                const files = await fileSystem.readdir(dir);
                const found = files.find((f: string) => f.endsWith('.done'));
                return found ? path.join(dir, found) : null;
            } catch { 
                return null; // Se a pasta não existir ou der erro de leitura, ignoramos
            }
        };

        const pastaProjeto = tarefaAtual.project?.pastaBase;
        const taskDir = controleExecucao.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        
        // Procura na pasta isolada da tarefa PRIMEIRO, depois na raiz do projeto
        const localDone = (await buscarDone(taskDir)) || (await buscarDone(pastaProjeto));

        controleExecucao.doneExists = !!localDone;
        controleExecucao.actualDonePath = localDone;

        // 2. VERIFICAÇÃO DE ALTERAÇÕES REAIS (Snapshot)
        try {
            const dirAlvo = pastaProjeto || taskDir;
            const currentSnapshot = await workspaceSnapshotService.takeSnapshot(dirAlvo);
            
            // Proteção contra snapshot inicial ausente (fallback gracioso)
            const initial = initialSnapshot || { files: {} }; 
            
            const changes = workspaceSnapshotService.compareSnapshots(initial, currentSnapshot);
            
            controleExecucao.hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
            controleExecucao.changesSummary = changes;
        } catch (snapError: any) {
            await log(`⚠️ Falha ao tirar snapshot do workspace: ${snapError.message}`);
            // Na dúvida, dizemos que não teve mudança para forçar o Juiz a questionar a IA
            controleExecucao.hasRealChanges = false; 
        }

        // 3. COLETA DE EVIDÊNCIAS
        const evidence = evidenceService.createEmptyEvidence();
        evidenceService.applyExecutionEvidence(evidence, controleExecucao.toolCall || {}, controleExecucao.toolResult || {}, { 
            executionDirectory: pastaProjeto || taskDir 
        });
        
        controleExecucao.evidence = evidence;

        await log(`✅ Inspeção concluída. Mudanças: ${controleExecucao.hasRealChanges ? 'Sim' : 'Não'}. .done encontrado: ${controleExecucao.doneExists ? 'Sim' : 'Não'}`);
    }
};