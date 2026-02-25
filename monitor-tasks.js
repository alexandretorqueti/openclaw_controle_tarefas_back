const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configurações
const API_URL = 'http://localhost:3001';
const TASKS_DIR = path.join(__dirname, 'pending-tasks');
const STATE_FILE = path.join(__dirname, 'monitor-state.json');
const LOG_FILE = '/home/alexandrebragatorqueti/projetos/jarbas-monitor.log';
const MY_USER_ID = '6bdbe73b-8178-4fd5-987d-50f3b73beb2b'; // ID do Jarbas
const MAX_LOG_LINES = 1000;

const STATUS = {
  IN_PROGRESS: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'
};
const MAX_FAILURES = 3;

function log(message) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const newLine = `[${timestamp}] ${message}`;
  console.log(newLine);
  try {
    let currentContent = fs.existsSync(LOG_FILE) ? fs.readFileSync(LOG_FILE, 'utf8') : '';
    let lines = [newLine, ...currentContent.split('\n')].filter(l => l.trim() !== '').slice(0, MAX_LOG_LINES);
    fs.writeFileSync(LOG_FILE, lines.join('\n') + '\n');
  } catch (e) { console.error(`Erro log: ${e.message}`); }
}

function get_state() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE));
      state.active_pids = state.active_pids || {};
      state.failure_counts = state.failure_counts || {};
      state.blocked_tasks = state.blocked_tasks || {};
      return state;
    } catch (e) { return { active_pids: {}, failure_counts: {}, blocked_tasks: {} }; }
  }
  return { active_pids: {}, failure_counts: {}, blocked_tasks: {} };
}

function save_state(state) { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); }

function isPidRunning(pid) {
  if (!pid) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return false; }
}

async function cleanupTaskFiles(taskId) {
  if (!fs.existsSync(TASKS_DIR)) return;
  fs.readdirSync(TASKS_DIR).forEach(f => {
    if (f.includes(taskId)) try { fs.unlinkSync(path.join(TASKS_DIR, f)); } catch(e) {}
  });
}

/**
 * Monta o prompt rico com Regras do Projeto e Comentários
 */
async function createExecuteScript(task) {
  const scriptPath = path.join(TASKS_DIR, `execute-${task.id}.sh`);
  const promptPath = path.join(TASKS_DIR, `prompt-${task.id}.txt`);
  const resultPath = path.join(TASKS_DIR, `result-${task.id}.txt`);
  
  // 1. Buscar detalhes completos do projeto (para pegar o campo REGRAS)
  let projetoRegras = "Nenhuma regra específica definida.";
  try {
    const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    projetoRegras = projRes.data.project?.regras || projetoRegras;
  } catch (e) { log(`[AVISO] Falha ao buscar regras do projeto: ${e.message}`); }

  // 2. Buscar comentários da tarefa
  let comentariosTexto = "Nenhum comentário até o momento.";
  try {
    const commRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
    const comments = commRes.data.comments || [];
    if (comments.length > 0) {
      comentariosTexto = comments
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
        .map(c => {
          const data = new Date(c.createdAt).toLocaleString('pt-BR');
          return `[${data}] ${c.user?.nickname || 'Usuário'}: ${c.content}`;
        })
        .join('\n');
    }
  } catch (e) { log(`[AVISO] Falha ao buscar comentários: ${e.message}`); }

  const promptContent = `### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
PROJETO: ${task.project?.name || 'N/A'}
DESCRIÇÃO: ${task.description}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
${projetoRegras}

### HISTÓRICO DE COMENTÁRIOS ###
${comentariosTexto}

### INSTRUÇÕES DE EXECUÇÃO ###
1. Você deve realizar as alterações no código baseando-se na descrição, nas regras do projeto e no histórico de conversa acima.
2. É OBRIGATÓRIO escrever um resumo técnico detalhado de TUDO o que foi alterado no arquivo: ${resultPath}
3. Se houver erro técnico, relate-o no arquivo de resultado para análise.
4. Não encerre a sessão sem confirmar que as mudanças foram salvas no sistema de arquivos.`;

  fs.writeFileSync(promptPath, promptContent);

  const scriptContent = `#!/bin/bash
export PATH=$PATH:/usr/local/bin:/home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin
node /home/alexandrebragatorqueti/.nvm/versions/node/v24.11.0/bin/openclaw sessions spawn --task "$(cat "${promptPath}")" --label "Jarbas-${task.id}" --mode run >> "${LOG_FILE}" 2>&1
`;
  fs.writeFileSync(scriptPath, scriptContent);
  fs.chmodSync(scriptPath, '755');
}

async function finalizeTask(taskId, state) {
  const resultPath = path.join(TASKS_DIR, `result-${taskId}.txt`);
  
  if (!fs.existsSync(resultPath)) {
    log(`[BLOQUEIO] Agente terminou sem gerar relatório para ${taskId}.`);
    delete state.active_pids[taskId];
    return;
  }

  const report = fs.readFileSync(resultPath, 'utf8').trim();

  try {
    await axios.put(`${API_URL}/api/tasks/${taskId}`, { statusId: STATUS.COMPLETED });
    await axios.post(`${API_URL}/api/comments`, { 
      content: `🤖 RELATÓRIO DE EXECUÇÃO:\n\n${report}`,
      taskId: taskId,
      userId: MY_USER_ID
    });
    
    log(`[SUCESSO] Tarefa ${taskId} finalizada.`);
    await cleanupTaskFiles(taskId);
    delete state.active_pids[taskId];
  } catch (error) {
    log(`[ERRO] Falha ao finalizar tarefa ${taskId}: ${error.message}`);
  }
}

async function monitorTasks() {
  log(`>>> INÍCIO DO CICLO (PROMPT RICO) <<<`);
  try {
    if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
    let state = get_state();
    state.active_pids = state.active_pids || {};

    // Limpeza inicial: remover PIDs que não estão mais rodando e contar falhas
    for (const taskId of Object.keys(state.active_pids)) {
      if (!isPidRunning(state.active_pids[taskId])) {
        log(`[LIMPEZA] PID morto para tarefa ${taskId}, removendo do estado`);
        // Incrementar contador de falhas
        state.failure_counts[taskId] = (state.failure_counts[taskId] || 0) + 1;
        log(`[FALHA] Tarefa ${taskId} falhou ${state.failure_counts[taskId]} vez(es)`);
        
        if (state.failure_counts[taskId] >= MAX_FAILURES) {
          log(`[BLOQUEIO] Tarefa ${taskId} excedeu ${MAX_FAILURES} falhas, bloqueando`);
          state.blocked_tasks[taskId] = true;
          // Opcional: mudar status para Concluído (não visível para IA) para evitar novas tentativas
          try {
            await axios.put(`${API_URL}/api/tasks/${taskId}`, { statusId: STATUS.COMPLETED });
            log(`[STATUS] Tarefa ${taskId} movida para Concluído (bloqueada)`);
          } catch (e) { log(`[ERRO] Falha ao atualizar status: ${e.message}`); }
        }
        
        // Limpar arquivos da tarefa (se existirem) sem relatório - desativado temporariamente
        // await cleanupTaskFiles(taskId);
        delete state.active_pids[taskId];
      }
    }
    save_state(state);

    const runningTasks = Object.keys(state.active_pids).filter(tid => isPidRunning(state.active_pids[tid]));
    
    if (runningTasks.length > 0) {
      log(`[AGUARDANDO] Agente em execução: ${runningTasks[0]}`);
      // Ainda pode haver PIDs que morreram após a limpeza? (improvável)
      save_state(state);
      return;
    }

    const statusRes = await axios.get(`${API_URL}/api/statuses`);
    const aiStatuses = (statusRes.data.statuses || []).filter(s => s.visible_to_ai === true).map(s => s.id);
    const tasksRes = await axios.get(`${API_URL}/api/tasks?isCompleted=false`);
    const aiTasks = (tasksRes.data.tasks || []).filter(t => aiStatuses.includes(t.statusId));
    // Filtrar tarefas bloqueadas
    const eligibleTasks = aiTasks.filter(t => !state.blocked_tasks[t.id]);

    if (eligibleTasks.length > 0) {
      const task = eligibleTasks[0];
      log(`[NOVA] Iniciando: ${task.title}`);
      
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
      fs.writeFileSync(path.join(TASKS_DIR, `task-${task.id}.json`), JSON.stringify(task, null, 2));
      
      await createExecuteScript(task);
      
      const subprocess = spawn(path.join(TASKS_DIR, `execute-${task.id}.sh`), [], { detached: true, stdio: 'ignore' });
      state.active_pids[task.id] = subprocess.pid;
      subprocess.unref();
    } else if (aiTasks.length > 0) {
      log(`[BLOQUEIO] Todas as tarefas visíveis estão bloqueadas (${aiTasks.length} tarefas)`);
    }

    save_state(state);
    log(`>>> FIM DO CICLO <<<`);
  } catch (error) { log(`[CRÍTICO] ${error.message}`); }
}

monitorTasks();
