"use strict";
// src/steps/PreparaPromptDeCorrecao.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.passoPreparaPromptDeCorrecao = void 0;
const logger_1 = require("../aux/logger");
const container_1 = __importDefault(require("../container"));
exports.passoPreparaPromptDeCorrecao = {
    name: 'Prepara Prompt de Correção',
    func: async (ctx) => {
        const { tarefaAtual, config } = ctx;
        if (!tarefaAtual || !tarefaAtual.feedbackForNextTurn)
            return;
        const fileSystem = container_1.default.resolve('fileSystem');
        const path = container_1.default.resolve('path');
        await (0, logger_1.log)(`🔧 Preparando prompt de correção para a tarefa ${tarefaAtual.id}...`);
        // 1. Construção do Prompt de Feedback
        // Instruímos a IA a focar apenas no que deu errado na última iteração
        const feedbackPrompt = `
=== FEEDBACK DO SISTEMA ===
Ocorreu um problema ou pendência na sua última ação:
${tarefaAtual.feedbackForNextTurn}

Por favor, analise as evidências acima, corrija o erro e continue a tarefa até concluir os requisitos e gerar o arquivo '.done'.
`.trim();
        // 2. Atualizamos o 'promptVez' na prancheta
        // O próximo passo (Executa OpenClaw) sempre lê 'promptVez'
        tarefaAtual.promptVez = feedbackPrompt;
        // 3. Log em arquivo para auditoria (salvo DENTRO da pasta da tarefa)
        const currentLoop = tarefaAtual.loopsExecutados || 1;
        const taskFolder = tarefaAtual.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        const logPath = path.join(taskFolder, `prompt-retry-loop-${currentLoop}.txt`);
        try {
            // fileSystem do container deve expor writeFile
            await fileSystem.writeFile(logPath, feedbackPrompt);
        }
        catch (err) {
            await (0, logger_1.log)(`⚠️ Erro ao salvar log do prompt de correção no disco: ${err.message}`);
        }
        await (0, logger_1.log)(`✅ Feedback de correção injetado. Próxima tentativa: ${currentLoop + 1}`);
    }
};
