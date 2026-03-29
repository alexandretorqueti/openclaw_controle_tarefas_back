
// src/steps/ExecucaoProgramador.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';

export const passoExecucaoProgramador: Passo = {
    name: 'Prepara para Programador',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, controleExecucao } = ctx;

        if (!tarefaAtual) return;

        await log(`👔 Analisando perfil da tarefa ${tarefaAtual.id} para alocação de agente...`);
        
        // 1. Determina o agente baseado no domínio
        let agent = null;
        
        if (tarefaAtual.domain === 'BACKEND') {
            agent = tarefaAtual.project?.programadorBack || 'default-backend-agent';
        } else if (tarefaAtual.domain === 'FRONTEND') {
            agent = tarefaAtual.project?.programadorFront || 'default-frontend-agent';
        } 
        
        // 2. Validação de Domínio (Safety Check)
        if (!agent) {
            await log(`⚠️ ERRO: Domínio inválido ou ausente ('${tarefaAtual.domain}'). Tarefa não pode ser alocada.`);
            controleExecucao.erroExecucao = true;
            return; 
        }
        
        if (agent.includes('default')) {
            await log(`⚠️ Aviso: Usando agente padrão para ${tarefaAtual.domain}: ${agent}`);
        }
        
        // 3. Deixa a "migalha" para o OpenClaw usar no próximo passo
        controleExecucao.agenteAlocado = agent;
        controleExecucao.loopsExecutados = 0; // Prepara o contador para o loop de correção
        
        await log(`👨‍💻 Agente alocado com sucesso: ${agent} (${tarefaAtual.domain}). Enviando para a bancada de trabalho...`);
    }
};

