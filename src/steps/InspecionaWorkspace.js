"use strict";
// src/steps/InspecionaWorkspace.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoInspecionaWorkspace = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoInspecionaWorkspace = {
    name: 'Inspeciona Workspace',
    func: async (ctx) => {
        const { tarefaAtual, config } = ctx;
        if (!tarefaAtual)
            return;
        const fileSystem = container_1.default.resolve('fileSystem');
        const path = container_1.default.resolve('path');
        const workspaceSnapshotService = container_1.default.resolve('workspaceSnapshotService');
        const evidenceService = container_1.default.resolve('evidenceService');
        await (0, logger_1.log)(`🔍 Inspecionando cena do crime no workspace da tarefa ${tarefaAtual.id}...`);
        // 1. VERIFICAÇÃO DE .DONE (A Arma do Crime)
        const buscarDone = async (dir) => {
            if (!dir)
                return null;
            try {
                const files = await fileSystem.readdir(dir);
                const found = files.find((f) => f.endsWith('.done'));
                return found ? path.join(dir, found) : null;
            }
            catch {
                return null; // Se a pasta não existir ou der erro de leitura, ignoramos
            }
        };
        const pastaProjeto = tarefaAtual.project?.pastaBase;
        const taskDir = tarefaAtual.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        // Procura na pasta isolada da tarefa PRIMEIRO, depois na raiz do projeto
        const localDone = (await buscarDone(taskDir)) || (await buscarDone(pastaProjeto));
        tarefaAtual.doneExists = !!localDone;
        tarefaAtual.actualDonePath = localDone;
        // 2. VERIFICAÇÃO DE ALTERAÇÕES REAIS (Snapshot)
        try {
            const dirAlvo = pastaProjeto || taskDir;
            const currentSnapshot = await workspaceSnapshotService.takeSnapshot(dirAlvo);
            // Proteção contra snapshot inicial ausente (fallback gracioso)
            const initial = tarefaAtual.initialSnapshot || { files: {} };
            const changes = workspaceSnapshotService.compareSnapshots(initial, currentSnapshot);
            tarefaAtual.hasRealChanges = changes.modified.length > 0 || changes.created.length > 0;
            tarefaAtual.changesSummary = changes;
        }
        catch (snapError) {
            await (0, logger_1.log)(`⚠️ Falha ao tirar snapshot do workspace: ${snapError.message}`);
            // Na dúvida, dizemos que não teve mudança para forçar o Juiz a questionar a IA
            tarefaAtual.hasRealChanges = false;
        }
        // 3. COLETA DE EVIDÊNCIAS
        const evidence = evidenceService.createEmptyEvidence();
        evidenceService.applyExecutionEvidence(evidence, tarefaAtual.toolCall || {}, tarefaAtual.toolResult || {}, {
            executionDirectory: pastaProjeto || taskDir
        });
        tarefaAtual.evidence = evidence;
        await (0, logger_1.log)(`✅ Inspeção concluída. Mudanças: ${tarefaAtual.hasRealChanges ? 'Sim' : 'Não'}. .done encontrado: ${tarefaAtual.doneExists ? 'Sim' : 'Não'}`);
    }
};
