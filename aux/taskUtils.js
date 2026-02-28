// taskUtils.js

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { log } = require('./logger');
const { save_state } = require('./state');
const { API_URL, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, MY_USER_ID, STATUS, TASK_TIMEOUT_MS, MINUTOS } = require('./config');

/**
 * Verifica se a tarefa ativa terminou ou travou
 */
async function reconcileActiveTasks(state) {
  const activeTaskIds = Object.keys(state.active_tasks);
  if (activeTaskIds.length === 0) return false;

  const taskId = activeTaskIds[0];
  const taskState = state.active_tasks[taskId];
  const promptFile = path.join(TASKS_DIR, `prompt-${taskId}.txt`);
  const logFile = path.join(TASKS_DIR, `result-${taskId}.log`);
  const doneFile = path.join(TASKS_DIR, `result-${taskId}.done`); // Novo marcador de fim

  log(`🔎 Reconciliando tarefa em andamento: ${taskId}`);

  try {
    const taskRes = await axios.get(`${API_URL}/api/tasks/${taskId}`);
    const taskData = taskRes.data.task || taskRes.data;
    
    // 1. VERIFICAÇÃO: Backend já considera finalizada (isFinalState)
    if (taskData.status?.isFinalState === true) {
      await handleCompletedTask(taskId, taskData, promptFile, logFile, doneFile, state);
      return false; 
    }
    
    // 2. VERIFICAÇÃO: Status alterado manualmente no Kanban
    // (Assumindo que STATUS.IN_PROGRESS é o ID do status 'Em Andamento')
    if (taskData.statusId !== STATUS.IN_PROGRESS) {
      log(`📝 Tarefa ${taskId} não está mais "Em Andamento". Considerando como abandonada.`);
      await handleAbandonedTask(taskId, promptFile, logFile, doneFile, state, 'Status alterado manualmente no painel');
      return false; 
    }
    
    // 3. VERIFICAÇÃO: Marcador físico criado pela IA
    if (fs.existsSync(doneFile)) {
      log(`📄 Arquivo .done encontrado. A IA concluiu a execução física com sucesso.`);
      await handleCompletedTask(taskId, taskData, promptFile, logFile, doneFile, state);
      return false; 
    }
    
    // 4. VERIFICAÇÃO: Timeout
    const timeElapsed = Date.now() - taskState.startTime;
    if (timeElapsed > TASK_TIMEOUT_MS) {
      log(`⚠️ TIMEOUT! Tarefa ${taskId} rodando há mais de ${MINUTOS} minutos.`);
      await handleTimeoutTask(taskId, promptFile, logFile, doneFile, state);
      return false; 
    }
    
    log(`⏳ Tarefa ${taskId} em processamento (${Math.round(timeElapsed/60000)}m). Retendo fila.`);
    return true; 

  } catch (error) {
    log(`❌ Erro ao reconciliar tarefa ${taskId}: ${error.message}`);
    return true; // Assume ocupado em caso de falha de rede
  }
}

/**
 * Processa tarefa concluída e envia o relatório para o Histórico
 */
async function handleCompletedTask(taskId, taskData, promptFile, logFile, doneFile, state) {
  log(`✅ Finalizando tarefa ${taskId} na API...`);
  
  let executionNotes = "Execução concluída sem relatório em texto.";

  if (fs.existsSync(logFile)) {
    try {
      executionNotes = fs.readFileSync(logFile, 'utf8');
    } catch (e) {
      log(`⚠️ Não foi possível ler o arquivo de log: ${e.message}`);
    }
  }

  try {
    // A mágica acontece aqui: Chamamos o endpoint que trata tanto normais quanto recursivas
    // Ele vai atualizar lastExecutedAt, nextExecutionAt, mudar o status e salvar o history
    await axios.patch(`${API_URL}/api/tasks/${taskId}/finalize`, {
      userId: MY_USER_ID,
      executionNotes: executionNotes
    });
    log(`✅ Tarefa finalizada no banco. Histórico salvo.`);
  } catch (apiError) {
    const detail = apiError.response?.data ? JSON.stringify(apiError.response.data) : apiError.message;
    log(`❌ Erro fatal ao finalizar tarefa na API: ${detail}`);
  }

  // Limpeza de arquivos e estado
  try {
    if (fs.existsSync(promptFile)) fs.renameSync(promptFile, path.join(PROCESSED_DIR, `prompt-${taskId}.txt`));
    if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(PROCESSED_DIR, `result-${taskId}.log`));
    if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile); // Apaga o marcador
  } catch(e) {}

  delete state.active_tasks[taskId];
  save_state(state);
}

/**
 * Processa tarefa abandonada
 */
async function handleAbandonedTask(taskId, promptFile, logFile, doneFile, state, reason) {
  log(`🔄 Tarefa ${taskId} abandonada: ${reason}. Limpando recursos...`);
  
  try {
    await axios.post(`${API_URL}/api/comments`, {
      taskId: taskId,
      userId: MY_USER_ID,
      content: `🔄 **Execução local interrompida:** ${reason}. O monitor liberou a GPU.`
    });
  } catch (e) {
    log(`⚠️ Não foi possível postar comentário de abandono: ${e.message}`);
  }
  
  try {
    if (fs.existsSync(promptFile)) fs.renameSync(promptFile, path.join(ERROR_DIR, `prompt-${taskId}.txt`));
    if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(ERROR_DIR, `result-${taskId}.log`));
    if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
  } catch(e) {}

  delete state.active_tasks[taskId];
  save_state(state);
}

/**
 * Processa timeout
 */
async function handleTimeoutTask(taskId, promptFile, logFile, doneFile, state) {
  try {
    let devId = null;
    try {
      const usersRes = await axios.get(`${API_URL}/api/users`);
      // O ideal aqui seria buscar pelo nickname dinâmico e não hardcoded, 
      // mas mantive a sua lógica original
      const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
      if (dev) devId = dev.id;
    } catch (e) {}

    const updatePayload = { };
    if (devId) updatePayload.assignedToId = devId;

    await axios.put(`${API_URL}/api/tasks/${taskId}`, updatePayload);
    
    await axios.post(`${API_URL}/api/comments`, {
      taskId: taskId,
      userId: MY_USER_ID,
      content: `⚠️ **FALHA (TIMEOUT)**\nTarefa processou por mais de ${MINUTOS} minutos. Execução abortada.`
    });
    
  } catch (timeoutError) {
    log(`❌ Erro ao atualizar tarefa no timeout: ${timeoutError.message}`);
  } finally {
    try {
      if (fs.existsSync(promptFile)) fs.renameSync(promptFile, path.join(ERROR_DIR, `prompt-${taskId}.txt`));
      if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(ERROR_DIR, `result-${taskId}.log`));
      if (fs.existsSync(doneFile)) fs.unlinkSync(doneFile);
    } catch(e) {}

    delete state.active_tasks[taskId];
    save_state(state);
  }
}

/**
 * Monta o arquivo físico e retorna o texto puro do prompt para a IA
 */
async function prepareTaskPrompt(task) {
  const promptFile = path.join(TASKS_DIR, `prompt-${task.id}.txt`);
  const logFile = path.join(TASKS_DIR, `result-${task.id}.log`);
  const doneFile = path.join(TASKS_DIR, `result-${task.id}.done`); // Caminho para a IA usar

  let projetoRegras = "Nenhuma regra específica definida.";
  try {
    const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    projetoRegras = projRes.data?.regras || projetoRegras;
  } catch (e) { log(`Aviso: Sem regras do projeto.`); }

  let taskComments = "Nenhum comentário adicional.";
  try {
    const commentsRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
    const commentsArray = commentsRes.data.comments || commentsRes.data || []; 
    
    if (commentsArray.length > 0) {
      taskComments = commentsArray.map(c => 
        `[${c.user?.name || 'Usuário'} comentou]: ${c.content}`
      ).join('\n\n');
    }
  } catch (e) { log(`Aviso: Falha ao buscar comentários.`); }

  // === MONTAGEM FINAL DO PROMPT (INSTRUÇÕES SIMPLIFICADAS PARA A IA) ===
  const promptContent = `### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
DESCRIÇÃO: ${task.description}

### COMENTÁRIOS E HISTÓRICO DA TAREFA ###
${taskComments}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
${projetoRegras}

### INSTRUÇÕES OBRIGATÓRIAS PARA O AGENTE ###
Seu objetivo é analisar o problema e editar os arquivos de código necessários.
Ao terminar as alterações, VOCÊ DEVE EXECUTAR ESTES 2 PASSOS EXATAMENTE NESTA ORDEM ANTES DE ENCERRAR:

1. Use a ferramenta de terminal para criar um log detalhado do que você fez.
   Comando esperado: echo "Seu relatorio técnico aqui..." > ${logFile}

2. Use a ferramenta de terminal para criar o marcador de conclusão. ISSO É VITAL PARA LIBERAR O SISTEMA.
   Comando esperado: touch ${doneFile}
`;

  fs.writeFileSync(promptFile, promptContent);

  return `Leia as instruções detalhadas no arquivo físico: ${promptFile}. Execute a tarefa e não esqueça de criar o arquivo .done ao finalizar.`;
}

module.exports = { reconcileActiveTasks, prepareTaskPrompt };