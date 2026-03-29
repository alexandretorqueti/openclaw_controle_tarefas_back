"use strict";
// src/steps/InicializaTarefa.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoInicializaTarefa = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoInicializaTarefa = {
    // ⚠️ CORREÇÃO CRÍTICA: O nome deve bater exatamente com o workflowMap.ts
    name: 'Inicializa Tarefa',
    func: async (ctx) => {
        const { tarefaAtual, services, config } = ctx;
        const { lockService, stateService } = services;
        if (!tarefaAtual)
            return;
        await (0, logger_1.log)(`⚙️ Inicializando ambiente para a tarefa ${tarefaAtual.id}...`);
        // 1. LOCK: Tenta adquirir o lock específico
        const lockAdquirido = await lockService.acquireLock(tarefaAtual.id);
        if (!lockAdquirido) {
            await (0, logger_1.log)(`❌ Tarefa ${tarefaAtual.id} já está em processamento por outro worker.`);
            tarefaAtual.erroInicializacao = true; // Migalha para o Mapa abortar
            return;
        }
        // 2. ESTADO: Registra a tarefa como ativa
        await stateService.registerActiveTask(tarefaAtual.id);
        // 3. DISCO: Prepara o diretório de trabalho da tarefa (NOVO)
        try {
            const fileSystem = container_1.default.resolve('fileSystem');
            const path = container_1.default.resolve('path');
            // Ex: /tmp/tasks/123
            const taskDir = path.join(config.TASKS_DIR, tarefaAtual.id.toString());
            await fileSystem.mkdir(taskDir, { recursive: true });
            tarefaAtual.taskDir = taskDir; // Salva para o OpenClaw saber onde trabalhar
            await (0, logger_1.log)(`📁 Diretório de trabalho isolado criado.`);
        }
        catch (fsError) {
            await (0, logger_1.log)(`⚠️ Erro fatal ao criar diretório de trabalho: ${fsError.message}`);
            tarefaAtual.erroInicializacao = true;
            return; // Sem disco, não dá pra continuar
        }
        // 4. COMUNICAÇÃO: Atualiza o status na API
        try {
            const api = container_1.default.resolve('apiService') || axios_1.default;
            const statusResponse = await api.get(`${config.API_URL}/api/statuses`);
            const inProgressStatus = statusResponse.data?.statuses?.find((s) => s.name === config.STATUS?.IN_PROGRESS || s.name === 'Em Andamento');
            if (inProgressStatus) {
                await api.put(`${config.API_URL}/api/tasks/${tarefaAtual.id}`, {
                    statusId: inProgressStatus.id
                });
                await (0, logger_1.log)(`✅ Status atualizado para "Em Andamento".`);
            }
            else {
                await (0, logger_1.log)(`⚠️ Status "Em Andamento" não encontrado na API.`);
            }
        }
        catch (error) {
            await (0, logger_1.log)(`⚠️ Erro ao atualizar status na API: ${error.message} (Ignorando...)`);
            // Degradação graciosa: Se só a UI falhar, continuamos o trabalho técnico.
        }
    }
};
