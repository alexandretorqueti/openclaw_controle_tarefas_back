const axios = require('axios');

// Limite Global: Se a sua API (3001) não responder em 10 segundos, cancela.
// Evita que o Axios trave o script para sempre.
axios.defaults.timeout = 10000; 

const { API_URL, STATUS, MY_USER_ID } = require('./aux/config');
const { log } = require('./aux/logger');
const { verifyEnvironmentHealth } = require('./aux/network');
const { get_state, save_state } = require('./aux/state');
const { reconcileActiveTasks, prepareTaskPrompt } = require('./aux/taskUtils');
const LOCK_FILE = '/tmp/.monitor.lock';

async function run() {
  try {
    if (fs.existsSync(LOCK_FILE)) {
      console.log('Outra instância já está rodando');
      process.exit(0);
    }
    fs.writeFileSync(LOCK_FILE, process.pid.toString());
    await verifyEnvironmentHealth();
    let state = get_state();

    const isBusy = await reconcileActiveTasks(state);

    if (isBusy) {
      log("🚫 IA ocupada. Bloqueando novas tarefas.");
      console.log("Nenhuma tarefa elegível para IA");
      process.exit(0); // Força a saída limpa
    }

    const response = await axios.get(`${API_URL}/api/tasks/next/Jarbas`);
    
    if (!response.data.success || !response.data.task) {
      log("😴 Nenhuma tarefa nova na fila.");
      console.log("Nenhuma tarefa elegível para IA");
      process.exit(0); // Força a saída limpa
    }

    const task = response.data.task;
    log(`🎯 Preparando envio para o OpenClaw: [${task.id}] ${task.title}`);

    await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
    
    state.active_tasks[task.id] = { startTime: Date.now() };
    save_state(state);

    const promptString = await prepareTaskPrompt(task);
    const model = task.model
    const jsonOutput = {
      prompt: promptString,
      title: task.title,
      model: model
    };

    console.log("=== TASK_DATA_START ===");
    console.log(JSON.stringify(jsonOutput, null, 2));
    console.log("=== TASK_DATA_END ===");
    
    process.exit(0); // Sucesso total, libera o cron

  } catch (error) {
    // Agora capturamos a STACK inteira, e não só a message (que estava vindo vazia)
    log(`💥 Erro Fatal: ${error.stack || error.message || error}`);
    console.log("Nenhuma tarefa elegível para IA"); 
    process.exit(1); // Saída de erro
  }
}

run();