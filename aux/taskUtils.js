const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { log } = require('./logger');
const { save_state } = require('./state');
const { API_URL, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, MY_USER_ID, STATUS, TASK_TIMEOUT_MS } = require('./config');

/**
 * Verifica se a tarefa ativa terminou ou travou
 */
async function reconcileActiveTasks(state) {
  const activeTaskIds = Object.keys(state.active_tasks);
  if (activeTaskIds.length === 0) return false; // Nenhuma rodando

  const taskId = activeTaskIds[0];
  const taskState = state.active_tasks[taskId];
  const promptFile = path.join(TASKS_DIR, `prompt-${taskId}.txt`);
  const logFile = path.join(TASKS_DIR, `result-${taskId}.log`);

  log(`🔎 Reconciliando tarefa em andamento: ${taskId}`);

  try {
    // Consulta a API para ver a "verdade"
    const taskRes = await axios.get(`${API_URL}/api/tasks/${taskId}`);
    const taskData = taskRes.data; // <-- Correção: a tarefa vem direto no data!
    
    // Se ele vir que a IA já marcou como concluída
    if (taskData.statusId === STATUS.COMPLETED) {
      log(`✅ Tarefa ${taskId} foi concluída pela IA Gerando comentário...`);
      
      // 1. LÊ O ARQUIVO DE LOG DA IA ANTES DE MOVER
      if (fs.existsSync(logFile)) {
        try {
          const logContent = fs.readFileSync(logFile, 'utf8');
          
          const safeLogContent = logContent;

          // Atualiza o campo lastExecutedAt com a data e hora atuais
          await axios.put(`${API_URL}/api/tasks/${taskId}`, {
            lastExecutedAt: new Date().toISOString()
          });

          // 2. POSTA O COMENTÁRIO NA API
          await axios.post(`${API_URL}/api/comments`, {
            taskId: taskId,
            userId: MY_USER_ID,
            content: `🤖 **Relatório de Execução do Jarbas:**\n\n\`\`\`text\n${safeLogContent}\n\`\`\``
          });
          log(`✅ Comentário com o relatório adicionado à tarefa ${taskId}.`);
        } catch (commentError) {
          const detail = commentError.response?.data ? JSON.stringify(commentError.response.data) : commentError.message;
          log(`❌ Erro ao postar comentário do relatório: ${detail}`);
        }
      } else {
        log(`⚠️ O arquivo de log não foi encontrado. A IA finalizou sem gerar o relatório físico.`);
      }

      // 3. Move os arquivos para a pasta de processados
      if (fs.existsSync(promptFile)) fs.renameSync(promptFile, path.join(PROCESSED_DIR, `prompt-${taskId}.txt`));
      if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(PROCESSED_DIR, `result-${taskId}.log`));
      
      // 4. Limpa a VRAM e o estado
      delete state.active_tasks[taskId];
      save_state(state);
      return false; // Liberou a VRAM
    }

    // Se ainda não concluiu, verifica se deu Timeout (1 hora)
    const timeElapsed = Date.now() - taskState.startTime;
    if (timeElapsed > TASK_TIMEOUT_MS) {
      log(`⚠️ TIMEOUT! Tarefa ${taskId} rodando há mais de 1h. Devolvendo para Alexandre...`);
      
      try {
        let alexandreId = null;
        try {
          const usersRes = await axios.get(`${API_URL}/api/users`);
          const alexandre = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
          if (alexandre) alexandreId = alexandre.id;
        } catch (e) {
          log(`⚠️ Aviso: Falha ao buscar usuários da API.`);
        }

        const updatePayload = { };
        if (alexandreId) updatePayload.assignedToId = alexandreId;

        await axios.put(`${API_URL}/api/tasks/${taskId}`, updatePayload);
        
        await axios.post(`${API_URL}/api/comments`, {
          taskId: taskId,
          userId: MY_USER_ID,
          content: `⚠️ **FALHA (TIMEOUT)**\nTarefa processou por mais de uma hora e não houve retorno da IA. A execução foi abortada.`
        });
        
      } catch (timeoutError) {
        // Pega o erro detalhado da API (Zod/Prisma) para sabermos o que falhou
        const errorDetail = timeoutError.response?.data ? JSON.stringify(timeoutError.response.data) : timeoutError.message;
        log(`❌ Erro ao atualizar tarefa no timeout (API recusou): ${errorDetail}`);
      } finally {
        // O BLOCO FINALLY É A SALVAÇÃO: Ele roda DANDO ERRO OU NÃO.
        // Assim, limpamos o sistema de arquivos e a memória obrigatóriamente.
        try {
          if (fs.existsSync(promptFile)) fs.renameSync(promptFile, path.join(ERROR_DIR, `prompt-${taskId}.txt`));
          if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(ERROR_DIR, `result-${taskId}.log`));
        } catch(e) {} // ignora se o arquivo já sumiu

        delete state.active_tasks[taskId];
        save_state(state);
      }
      
      return false; // Libera a VRAM para a próxima!
    }

    log(`⏳ Tarefa ${taskId} ainda em processamento (${Math.round(timeElapsed/60000)}m). Retendo novos spawns.`);
    return true; // Continua ocupado

  } catch (error) {
    log(`❌ Erro ao reconciliar tarefa ${taskId}: ${error.message}`);
    return true; // Assume ocupado por segurança
  }
}

/**
 * Monta o arquivo físico e retorna o texto puro do prompt para o OpenClaw
 */
async function prepareTaskPrompt(task) {
  const promptFile = path.join(TASKS_DIR, `prompt-${task.id}.txt`);
  const logFile = path.join(TASKS_DIR, `result-${task.id}.log`);

  // Busca regras do projeto
  let projetoRegras = "Nenhuma regra específica definida.";
  try {
    const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    projetoRegras = projRes.data?.regras || projetoRegras;
  } catch (e) { log(`Aviso: Sem regras do projeto.`); }

  // === NOVA BUSCA: Pega os comentários da tarefa ===
  let taskComments = "Nenhum comentário adicional.";
  try {
    const commentsRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
    // Ajuste o '.comments' abaixo se o seu backend devolver o array direto no data
    const commentsArray = commentsRes.data.comments || commentsRes.data || []; 
    
    if (commentsArray.length > 0) {
      taskComments = commentsArray.map(c => 
        `[${c.user?.name || 'Usuário'} comentou]: ${c.content}`
      ).join('\n\n');
    }
  } catch (e) { log(`Aviso: Falha ao buscar comentários.`); }

  // === MONTAGEM FINAL DO PROMPT ===
  const promptContent = `### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
DESCRIÇÃO: ${task.description}

### COMENTÁRIOS E HISTÓRICO DA TAREFA ###
${taskComments}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
${projetoRegras}

### INSTRUÇÕES OBRIGATÓRIAS PARA O AGENTE ###
Você é o Jarbas. Seu objetivo é analisar o problema e editar os arquivos de código necessários.
Ao terminar as alterações no código, VOCÊ DEVE EXECUTAR ESTES 2 PASSOS ANTES DE ENCERRAR:

1. Use a ferramenta de terminal para criar um log físico do que você fez.
   Acrescente o nome do modelo que executou a tarefa no final do seu log.
   Comando esperado: echo "Seu relatorio técnico aqui..." > ${logFile}

2. Marque a tarefa como CONCLUÍDA na nossa API.
   Faça um PATCH para: ${API_URL}/api/tasks/${task.id}/finalize
`;

  // Salva fisicamente o contexto para auditoria e leitura
  fs.writeFileSync(promptFile, promptContent);

  // Retorna a instrução que vai dentro do JSON do cron
  return `Leia as instruções detalhadas no arquivo físico: ${promptFile}. Siga o passo a passo com rigor.`;
}

module.exports = { reconcileActiveTasks, prepareTaskPrompt };