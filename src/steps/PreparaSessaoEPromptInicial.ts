// src/steps/PreparaSessaoEPromptInicial.ts

import { Passo, ContextoExecucao } from "../interfaces/interfaceMonitor_old";
import { log } from '../aux/logger';
import container from '../container';
 const formatarComentarios = (comments: any[]): string => {
    if (!comments || comments.length === 0) {
        return 'Nenhum comentário adicional.';
    }

    // 1. Ordena do mais antigo para o mais novo (cronológico)
    const ordenados = [...comments].sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    // 2. Cria um mapa para sabermos quem respondeu a quem
    const mapaComentarios = new Map(ordenados.map(c => [c.id, c]));

    let textoFormatado = '';

    ordenados.forEach(c => {
        const autor = c.user?.nickname || c.user?.name || 'Usuário';
        const data = new Date(c.createdAt).toLocaleDateString('pt-BR');
        
        let cabecalho = `🗣️ [${data}] ${autor}`;
        
        // Se for uma resposta, avisa no cabeçalho
        if (c.parentCommentId && mapaComentarios.has(c.parentCommentId)) {
            const parent = mapaComentarios.get(c.parentCommentId);
            const parentAutor = parent?.user?.nickname || parent?.user?.name || 'Usuário';
            cabecalho += ` (respondendo a ${parentAutor})`;
        }

        textoFormatado += `${cabecalho}:\n"${c.content}"\n\n`;
    });

    return textoFormatado.trim();
  }
  
export const passoPreparaSessaoEPromptInicial: Passo = {
    name: 'Prepara Sessão e Prompt para Programador',
    func: async (ctx: ContextoExecucao) => {
        const { tarefaAtual, config, controleExecucao, utils, files } = ctx;

        if (!tarefaAtual) return;

        const fileSystem = container.resolve('fileSystem');
        const path = container.resolve('path');
        const promptFactory = utils.promptFactory;


        const TASKS_DIR = config.TASKS_DIR;
        const dirBase = config.BASE_DIR;
        const taskId = tarefaAtual.id;

        
        files.promptFile = path.join(TASKS_DIR, `prompt-${taskId}.txt`);
        files.relatorioFile = path.join(TASKS_DIR, `relatorio-${taskId}.txt`);
        files.doneFile = path.join(TASKS_DIR, `done-${taskId}.done`);
        files.terminalLogFile = path.join(TASKS_DIR, `terminal-${taskId}.log`);
        files.architectPlanFile = path.join(TASKS_DIR, `plano-arquiteto-${taskId}.txt`);
        files.architectLogFile = path.join(TASKS_DIR, `terminal-arquiteto-${taskId}.log`);
    
        await log(`🔗 Iniciando sessão de desenvolvimento para tarefa ${tarefaAtual.id}...`);

        // 1. Gerar Session ID único para este ciclo de vida
        const ts = new Date().getTime();
        controleExecucao.sessionId = `session-${tarefaAtual.id}-${ts}`;
        controleExecucao.loopsExecutados = 0; // Reset do contador de segurança para o novo loop

        // 2. Montagem do Prompt Base

        const comentariosFormatados = formatarComentarios(tarefaAtual.comments);
        const engineRules = promptFactory.buildEngineRulesPrompt(files, dirBase, tarefaAtual);
        const basePrompt = `DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\n
TAREFA: ${tarefaAtual.title}.
DESC: ${tarefaAtual.description}. 
REGRAS: ${(tarefaAtual.project && tarefaAtual.project.regras)? tarefaAtual.project.regras : 'Siga as boas práticas de desenvolvimento'}\n\n
COMENTÁRIOS: ${comentariosFormatados}\n\n
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