// src/steps/PreparaSessaoEPromptInicial.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoPreparaSessaoEPromptInicial: Passo = {
    name: 'Prepara Sessão e Prompt para Programador',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config, controleExecucao } = ctx;

        if (!tarefaAtual) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');
        const promptFactory = container.resolve('promptFactory');
        const CONFIG = container.resolve('config');

        const TASKS_DIR = config.TASKS_DIR;
        const dirBase = config.BASE_DIR;
        const taskId = tarefaAtual.id;

        const files = {
            promptFile: path.join(TASKS_DIR, `prompt-${taskId}.txt`),
            relatorioFile: path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
            doneFile: path.join(TASKS_DIR, `done-${taskId}.done`),
            terminalLogFile: path.join(TASKS_DIR, `terminal-${taskId}.log`),
            architectPlanFile: path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
            architectLogFile: path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
        };
        await log(`🔗 Iniciando sessão de desenvolvimento para tarefa ${tarefaAtual.id}...`);

        // 1. Gerar Session ID único para este ciclo de vida
        const ts = new Date().getTime();
        controleExecucao.sessionId = `session-${tarefaAtual.id}-${ts}`;
        controleExecucao.loopsExecutados = 0; // Reset do contador de segurança para o novo loop

        // 2. Montagem do Prompt Base

        const engineRules = promptFactory.buildEngineRulesPrompt(files);
        const basePrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\n
TAREFA: ${tarefaAtual.title}.
DESC: ${tarefaAtual.description}. 
BASE: ${dirBase}\n\n
${engineRules}`;
        
        // 3. INJEÇÃO VITAL NO CONTEXTO (Garantido fora do try/catch)
        // O próximo passo (Executa OpenClaw) depende disso para funcionar.
        controleExecucao.promptVez = basePrompt;

        // 4. Salvar o prompt inicial em disco para fins de log/debug e auditoria
        const taskFolder = controleExecucao.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        const promptPath = path.join(taskFolder, `prompt-init.txt`);
        
        try {
            await fileSystem.writeFile(promptPath, basePrompt);
            await log(`📝 Prompt inicial salvo em disco com sucesso.`);
        } catch (err: any) {
            // Apenas logamos o erro visual. A IA ainda vai rodar porque o promptVez já foi setado.
            await log(`⚠️ Erro não fatal ao salvar arquivo de prompt no disco: ${err.message}`);
        }

        await log(`✅ Sessão e Prompt Inicial preparados.`);
    }
};