"use strict";
// src/steps/PreparaSessaoEPromptInicial.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoPreparaSessaoEPromptInicial = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoPreparaSessaoEPromptInicial = {
    name: 'Prepara Sessão e Prompt para Programador',
    func: async (ctx) => {
        const { tarefaAtual, config, controleExecucao } = ctx;
        if (!tarefaAtual)
            return;
        const fileSystem = container_1.default.resolve('fileSystem');
        const path = container_1.default.resolve('path');
        const promptFactory = container_1.default.resolve('promptFactory');
        const CONFIG = container_1.default.resolve('config');
        const TASKS_DIR = config.TASKS_DIR;
        const dirBase = config.DIR_BASE;
        const commentsSection = config.COMMENTS_SECTION;
        const taskId = tarefaAtual.id;
        const files = {
            promptFile: path.join(TASKS_DIR, `prompt-${taskId}.txt`),
            relatorioFile: path.join(TASKS_DIR, `relatorio-${taskId}.txt`),
            doneFile: path.join(TASKS_DIR, `done-${taskId}.done`),
            terminalLogFile: path.join(TASKS_DIR, `terminal-${taskId}.log`),
            architectPlanFile: path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`),
            architectLogFile: path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`)
        };
        await (0, logger_1.log)(`🔗 Iniciando sessão de desenvolvimento para tarefa ${tarefaAtual.id}...`);
        // 1. Gerar Session ID único para este ciclo de vida
        const ts = new Date().getTime();
        controleExecucao.sessionId = `session-${tarefaAtual.id}-${ts}`;
        controleExecucao.loopsExecutados = 0; // Reset do contador de segurança para o novo loop
        // 2. Montagem do Prompt Base
        const engineRules = promptFactory.buildEngineRulesPrompt(files);
        const basePrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: ${tarefaAtual.title}. DESC: ${tarefaAtual.description}. BASE: ${dirBase}.${commentsSection}\n\n${engineRules}`;
        // 3. INJEÇÃO VITAL NO CONTEXTO (Garantido fora do try/catch)
        // O próximo passo (Executa OpenClaw) depende disso para funcionar.
        controleExecucao.promptVez = basePrompt;
        // 4. Salvar o prompt inicial em disco para fins de log/debug e auditoria
        const taskFolder = controleExecucao.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        const promptPath = path.join(taskFolder, `prompt-init.txt`);
        try {
            await fileSystem.writeFile(promptPath, basePrompt);
            await (0, logger_1.log)(`📝 Prompt inicial salvo em disco com sucesso.`);
        }
        catch (err) {
            // Apenas logamos o erro visual. A IA ainda vai rodar porque o promptVez já foi setado.
            await (0, logger_1.log)(`⚠️ Erro não fatal ao salvar arquivo de prompt no disco: ${err.message}`);
        }
        await (0, logger_1.log)(`✅ Sessão e Prompt Inicial preparados.`);
    }
};
