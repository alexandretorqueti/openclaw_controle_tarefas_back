// src/steps/PreparaPromptDeCorrecao.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoPreparaPromptDeCorrecao: Passo = {
    name: 'Prepara Prompt de Correção',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config, controleExecucao } = ctx;

        if (!tarefaAtual || !controleExecucao.feedbackForNextTurn) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');

        await log(`🔧 Preparando prompt de correção para a tarefa ${tarefaAtual.id}...`);

        // 1. Construção do Prompt de Feedback
        // Instruímos a IA a focar apenas no que deu errado na última iteração
        const feedbackPrompt = `
=== FEEDBACK DO SISTEMA ===
Ocorreu um problema ou pendência na sua última ação:
${controleExecucao.feedbackForNextTurn}

Por favor, analise as evidências acima, corrija o erro e continue a tarefa até concluir os requisitos e gerar o arquivo '.done'.
`.trim();

        // 2. Atualizamos o 'promptVez' na prancheta
        // O próximo passo (Executa OpenClaw) sempre lê 'promptVez'
        controleExecucao.promptVez = feedbackPrompt;

        // 3. Log em arquivo para auditoria (salvo DENTRO da pasta da tarefa)
        const currentLoop = controleExecucao.loopsExecutados || 1;
        const taskFolder = controleExecucao.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
        const logPath = path.join(taskFolder, `prompt-retry-loop-${currentLoop}.txt`);
        
        try {
            // fileSystem do container deve expor writeFile
            await fileSystem.writeFile(logPath, feedbackPrompt);
        } catch (err: any) {
            await log(`⚠️ Erro ao salvar log do prompt de correção no disco: ${err.message}`);
        }

        await log(`✅ Feedback de correção injetado. Próxima tentativa: ${currentLoop + 1}`);
    }
};