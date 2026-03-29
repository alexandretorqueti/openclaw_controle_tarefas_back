"use strict";
// src/steps/FinalizaTarefa.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoFinalizaTarefa = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoFinalizaTarefa = {
    name: 'Finaliza Tarefa',
    func: async (ctx) => {
        const { tarefaAtual, UserId, config } = ctx;
        if (!tarefaAtual)
            return;
        const fileSystem = container_1.default.resolve('fileSystem');
        const path = container_1.default.resolve('path');
        const taskService = container_1.default.resolve('taskService');
        await (0, logger_1.log)(`🏁 Finalizando tarefa ${tarefaAtual.id}...`);
        try {
            // 1. LIMPEZA: Deleta o arquivo .done para não poluir o repositório final
            if (tarefaAtual.actualDonePath) {
                await fileSystem.unlink(tarefaAtual.actualDonePath).catch(() => { });
            }
            // 2. COMUNICAÇÃO: Atualiza a API ANTES de mover os arquivos! (Segurança de Estado)
            await taskService.updateTask(tarefaAtual.id, {
                status: 'COMPLETED',
                completedBy: UserId,
                completedAt: new Date().toISOString()
            });
            await (0, logger_1.log)(`✅ Tarefa ${tarefaAtual.id} marcada como CONCLUÍDA na API.`);
            // 3. ORGANIZAÇÃO: Só movemos a pasta se a API confirmou o recebimento
            const sourceDir = path.join(config.TASKS_DIR, tarefaAtual.id.toString());
            const destDir = path.join(config.PROCESSED_DIR, tarefaAtual.id.toString());
            // Garante que a pasta de destino existe e move
            await fileSystem.mkdir(config.PROCESSED_DIR, { recursive: true }).catch(() => { });
            await fileSystem.rename(sourceDir, destDir);
            await (0, logger_1.log)(`📁 Arquivos da tarefa arquivados em 'processed'.`);
            // 4. MIGALHA DE SUCESSO ABSOLUTO
            tarefaAtual.finalizadaComSucesso = true;
        }
        catch (error) {
            await (0, logger_1.log)(`⚠️ Erro durante a finalização da tarefa: ${error.message}`);
            // Deixa a migalha de erro para auditoria
            tarefaAtual.erroFinalizacao = true;
        }
    }
};
