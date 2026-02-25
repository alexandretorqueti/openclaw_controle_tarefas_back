const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// Configurações
const API_URL = 'http://localhost:3001';
const TASKS_DIR = path.join(__dirname, 'pending-tasks');
const STATE_FILE = path.join(__dirname, 'monitor-state.json');
const LOG_FILE = path.join(__dirname, '..', '..', 'jarbas-monitor.log');
const MY_USER_ID = '7147090795'; // Seu ID (Alexandre)

const STATUS = {
  PENDING: '66b65e9c-88c5-49ce-994b-608281780ba6',
  IN_PROGRESS: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'
};

function log(message) {
  const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
  const logMsg = `[${timestamp}] ${message}\n`;
  console.log(logMsg.trim());
  fs.appendFileSync(LOG_FILE, logMsg);
}

function get_state() {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const state = JSON.parse(fs.readFileSync(STATE_FILE));
      state.active_pids = state.active_pids || {};
      state.failure_counts = state.failure_counts || {};
      return state;
    } catch (e) {
      return { failure_counts: {}, active_pids: {} };
    }
  }
  return { failure_counts: {}, active_pids: {} };
}

function save_state(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

async function updateTaskStatus(taskId, statusId, comment = null) {
  try {
    // Atualiza status da tarefa
    await axios.put(`${API_URL}/api/tasks/${taskId}`, { statusId });
    
    // Tenta adicionar comentário via rota de comentários
    if (comment) {
      try {
        await axios.post(`${API_URL}/api/comments`, { 
          content: comment,
          taskId: taskId,
          userId: MY_USER_ID 
        });
      } catch (e) {
        log(`⚠️ Nota: Comentário não pôde ser enviado (rota /api/comments): ${e.message}`);
      }
    }
    
    log(`✅ Tarefa ${taskId} atualizada para status ${statusId}`);
    return true;
  } catch (error) {
    log(`❌ Erro ao atualizar tarefa ${taskId}: ${error.message}`);
    return false;
  }
}

function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
}

async function cleanupTaskFiles(taskId) {
  if (!fs.existsSync(TASKS_DIR)) return;
  const files = fs.readdirSync(TASKS_DIR);
  let removed = 0;
  files.forEach(file => {
    if (file.includes(taskId)) {
      try { 
        fs.unlinkSync(path.join(TASKS_DIR, file)); 
        removed++;
      } catch(e) {}
    }
  });
  if (removed > 0) log(`🧹 Limpeza: ${removed} arquivos da tarefa ${taskId} removidos.`);
}

function startAgent(taskId, state) {
  const executeScript = path.join(TASKS_DIR, `execute-${taskId}.sh`);
  if (fs.existsSync(executeScript)) {
    log(`🚀 Iniciando agente para ${taskId}`);
    const out = fs.openSync(LOG_FILE, 'a');
    const subprocess = spawn(executeScript, [], {
      detached: true,
      stdio: [ 'ignore', out, out ]
    });
    
    state.active_pids[taskId] = subprocess.pid;
    subprocess.unref();
    return true;
  }
  return false;
}

async function monitorTasks() {
  try {
    if (!fs.existsSync(TASKS_DIR)) fs.mkdirSync(TASKS_DIR, { recursive: true });
    let state = get_state();

    // 1. Verificar arquivos locais
    const localFiles = fs.readdirSync(TASKS_DIR).filter(f => f.startsWith('task-') && f.endsWith('.json'));
    
    for (const file of localFiles) {
      const taskId = file.replace('task-', '').replace('.json', '');
      const pid = state.active_pids[taskId];

      try {
        const response = await axios.get(`${API_URL}/api/tasks/${taskId}`);
        const apiTask = response.data;

        // Se a tarefa já está concluída na API, limpamos localmente e pulamos
        if (!apiTask || apiTask.statusId === STATUS.COMPLETED) {
          await cleanupTaskFiles(taskId);
          delete state.failure_counts[taskId];
          delete state.active_pids[taskId];
          continue;
        }

        // Se o agente parou, finalizamos a tarefa
        if (!pid || !isPidRunning(pid)) {
          log(`🏁 Agente da tarefa ${taskId} terminou.`);
          const success = await updateTaskStatus(taskId, STATUS.COMPLETED, 'Tarefa concluída.');
          if (success) {
            await cleanupTaskFiles(taskId);
            delete state.failure_counts[taskId];
            delete state.active_pids[taskId];
          } else {
            state.failure_counts[taskId] = (state.failure_counts[taskId] || 0) + 1;
          }
        }
      } catch (err) {
        if (err.response && err.response.status === 404) {
          log(`Tarefa ${taskId} não existe mais.`);
          await cleanupTaskFiles(taskId);
          delete state.active_pids[taskId];
        }
      }
    }

    // 2. Buscar novas tarefas
    const response = await axios.get(`${API_URL}/api/tasks?statusId=${STATUS.PENDING}`);
    // Ajuste para o formato da resposta da API (baseado no curl anterior)
    const tasksData = response.data.tasks || (Array.isArray(response.data) ? response.data : []);

    for (const task of tasksData) {
      if (localFiles.some(f => f.includes(task.id))) continue;

      log(`Nova tarefa encontrada: ${task.id}`);
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
      fs.writeFileSync(path.join(TASKS_DIR, `task-${task.id}.json`), JSON.stringify(task, null, 2));
      startAgent(task.id, state);
    }

    save_state(state);
  } catch (error) {
    log(`Erro: ${error.message}`);
  }
}

monitorTasks();
