"use strict";
// src/steps/ExecutaOpenClaw.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoExecutaOpenClaw = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoExecutaOpenClaw = {
    name: 'Executa OpenClaw',
    func: async (ctx) => {
        const { tarefaAtual, config } = ctx;
        if (!tarefaAtual)
            return;
        // Proteção anti-loop infinito no Workflow Engine
        if (!tarefaAtual.promptVez) {
            await (0, logger_1.log)(`⚠️ ERRO CRÍTICO: OpenClaw chamado sem 'promptVez' definido. Abortando execução.`);
            tarefaAtual.erroFatalIA = true;
            return;
        }
        // 1. Incrementa o contador de segurança (Prevenção de Loop Infinito do LLM)
        tarefaAtual.loopsExecutados = (tarefaAtual.loopsExecutados || 0) + 1;
        const agente = tarefaAtual.agenteAlocado || 'main'; // Corrigido para bater com o passo anterior
        await (0, logger_1.log)(`🤖 [Tentativa ${tarefaAtual.loopsExecutados}] Chamando IA (${agente}) para a tarefa ${tarefaAtual.id}...`);
        // 2. Resolvemos o serviço do container
        const openClawService = container_1.default.resolve('openClawService');
        try {
            // 3. Execução Real
            const res = await openClawService.executeWithFallback(tarefaAtual.sessionId, tarefaAtual.promptVez, agente, 'backup-agent', // Pode vir do config futuramente
            null, config.TASKS_DIR, tarefaAtual.terminalLogFile, tarefaAtual.project?.pastaBase, config.TASK_TIMEOUT_MS);
            // 4. ANOTAÇÕES NA PRANCHETA (Migalhas para o Juiz)
            tarefaAtual.rawOutput = res.rawOutput || '';
            tarefaAtual.toolCall = res.toolCall || {};
            tarefaAtual.toolResult = res.toolResult || {};
            tarefaAtual.toolFeedback = res.toolFeedback || null;
            // Sucesso na chamada! Limpamos qualquer flag de erro anterior
            tarefaAtual.erroFatalIA = false;
            await (0, logger_1.log)(`✅ Execução do OpenClaw concluída. Resposta registrada.`);
        }
        catch (error) {
            await (0, logger_1.log)(`💥 Erro crítico de comunicação/execução no OpenClaw: ${error.message}`);
            tarefaAtual.erroFatalIA = true;
            tarefaAtual.ultimoErro = error.message;
        }
    }
};
