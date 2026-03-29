// src/steps/ExecutaOpenClaw.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoExecutaOpenClaw: Passo = {
    name: 'Programador',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config, controleExecucao } = ctx;
        
        if (!tarefaAtual) return;

        // Proteção anti-loop infinito no Workflow Engine
        if (!controleExecucao.promptVez) {
            await log(`⚠️ ERRO CRÍTICO: OpenClaw chamado sem 'promptVez' definido. Abortando execução.`);
            controleExecucao.erroFatalIA = true;
            return;
        }

        // 1. Incrementa o contador de segurança (Prevenção de Loop Infinito do LLM)
        controleExecucao.loopsExecutados = (controleExecucao.loopsExecutados || 0) + 1;
        
        const agente = controleExecucao.agenteAlocado || 'main'; // Corrigido para bater com o passo anterior
        await log(`🤖 [Tentativa ${controleExecucao.loopsExecutados}] Chamando IA (${agente}) para a tarefa ${tarefaAtual.id}...`);

        // 2. Resolvemos o serviço do container
        const openClawService = container.resolve('openClawService');

        try {
            // 3. Execução Real
            const res = await openClawService.executeWithFallback(
                controleExecucao.sessionId,
                controleExecucao.promptVez,
                agente,
                'backup-agent', // Pode vir do config futuramente
                null,
                config.TASKS_DIR,
                controleExecucao.terminalLogFile,
                tarefaAtual.project?.pastaBase,
                config.TASK_TIMEOUT_MS
            );

            // 4. ANOTAÇÕES NA PRANCHETA (Migalhas para o Juiz)
            controleExecucao.rawOutput = res.rawOutput || '';
            controleExecucao.toolCall = res.toolCall || {};
            controleExecucao.toolResult = res.toolResult || {};
            controleExecucao.toolFeedback = res.toolFeedback || null;
            
            // Sucesso na chamada! Limpamos qualquer flag de erro anterior
            controleExecucao.erroFatalIA = false;
            await log(`✅ Execução do OpenClaw concluída. Resposta registrada.`);

        } catch (error: any) {
            await log(`💥 Erro crítico de comunicação/execução no OpenClaw: ${error.message}`);
            controleExecucao.erroFatalIA = true;
            controleExecucao.ultimoErro = error.message;
        }
    }
};