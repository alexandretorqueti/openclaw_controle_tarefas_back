// src/steps/PreparaSessaoEPromptInicial.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor";
import { log } from '../aux/logger';
import container from '../container';

export const passoPreparaSessaoEPromptInicial: Passo = {
    name: 'Prepara Sessão e Prompt Inicial',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config } = ctx;

        if (!tarefaAtual) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');

        await log(`🔗 Iniciando sessão de desenvolvimento para tarefa ${tarefaAtual.id}...`);

        // 1. Gerar Session ID único para este ciclo de vida
        const ts = new Date().getTime();
        tarefaAtual.sessionId = `session-${tarefaAtual.id}-${ts}`;
        tarefaAtual.loopsExecutados = 0; // Reset do contador de segurança para o novo loop

        // 2. Montagem do Prompt Base
        const basePrompt = `
=== TAREFA [${tarefaAtual.id}] ===
Título: ${tarefaAtual.title}
Descrição: ${tarefaAtual.description}

=== REGRAS DO PROJETO ===
${tarefaAtual.project?.instructions || 'Siga as boas práticas de desenvolvimento do framework atual.'}

=== INSTRUÇÕES DE SAÍDA ===
Ao finalizar todos os requisitos acima, você DEVE criar um arquivo vazio chamado '.done' na raiz do projeto ou diretório de trabalho utilizando a ferramenta de execução de comandos (terminal) ou de criação de arquivos. Este arquivo sinalizará ao sistema que você concluiu o trabalho.
`.trim();

        // 3. INJEÇÃO VITAL NO CONTEXTO (Garantido fora do try/catch)
        // O próximo passo (Executa OpenClaw) depende disso para funcionar.
        tarefaAtual.promptVez = basePrompt;

        // 4. Salvar o prompt inicial em disco para fins de log/debug e auditoria
        const taskFolder = tarefaAtual.taskDir || path.join(config.TASKS_DIR, tarefaAtual.id.toString());
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