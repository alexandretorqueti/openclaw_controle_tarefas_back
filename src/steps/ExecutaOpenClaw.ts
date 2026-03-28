// src/steps/ExecutaOpenClaw.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoExecutaOpenClaw: Passo = {
    name: 'Executa OpenClaw',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config } = ctx;
        
        if (!tarefaAtual) return;

        // Proteção anti-loop infinito no Workflow Engine
        if (!tarefaAtual.promptVez) {
            await log(`⚠️ ERRO CRÍTICO: OpenClaw chamado sem 'promptVez' definido. Abortando execução.`);
            tarefaAtual.erroFatalIA = true;
            return;
        }

        // 1. Incrementa o contador de segurança (Prevenção de Loop Infinito do LLM)
        tarefaAtual.loopsExecutados = (tarefaAtual.loopsExecutados || 0) + 1;
        
        const agente = tarefaAtual.agenteAlocado || 'main'; // Corrigido para bater com o passo anterior
        await log(`🤖 [Tentativa ${tarefaAtual.loopsExecutados}] Chamando IA (${agente}) para a tarefa ${tarefaAtual.id}...`);

        // 2. Resolvemos o serviço do container
        const openClawService = container.resolve('openClawService');

        try {
            // 3. Execução Real
            const res = await openClawService.executeWithFallback(
                tarefaAtual.sessionId,
                tarefaAtual.promptVez,
                agente,
                'backup-agent', // Pode vir do config futuramente
                null,
                config.TASKS_DIR,
                tarefaAtual.terminalLogFile,
                tarefaAtual.project?.pastaBase,
                config.TASK_TIMEOUT_MS
            );

            // 4. ANOTAÇÕES NA PRANCHETA (Migalhas para o Juiz)
            tarefaAtual.rawOutput = res.rawOutput || '';
            tarefaAtual.toolCall = res.toolCall || {};
            tarefaAtual.toolResult = res.toolResult || {};
            tarefaAtual.toolFeedback = res.toolFeedback || null;
            
            // Sucesso na chamada! Limpamos qualquer flag de erro anterior
            tarefaAtual.erroFatalIA = false;
            await log(`✅ Execução do OpenClaw concluída. Resposta registrada.`);

        } catch (error: any) {
            await log(`💥 Erro crítico de comunicação/execução no OpenClaw: ${error.message}`);
            tarefaAtual.erroFatalIA = true;
            tarefaAtual.ultimoErro = error.message;
        }
    }
};