const { fi } = require('zod/v4/locales');

async function main() {
  const axios = require('axios');
  const fs = require('fs');
  // Limite Global: Se a sua API (3001) não responder em 10 segundos, cancela.
  // Evita que o Axios trave o script para sempre.
  axios.defaults.timeout = 10000; 

  const { API_URL, STATUS, STATE_FILE } = require('./aux/config');
  const { log } = require('./aux/logger');
  const { verifyEnvironmentHealth } = require('./aux/network');
  const { get_state, save_state } = require('./aux/state');
  const { reconcileActiveTasks, prepareTaskPrompt } = require('./aux/taskUtils');
  const LOCK_FILE = '/home/alexandrebragatorqueti/tmp/.monitor.lock';

  async function run() {
    console.log('🚀 Iniciando monitor de tarefas para IA...');
    try {
      // verifica existência de lock sem usar fs.promises.exists
      async function fileExists(path) {
        try {
          await fs.promises.access(path, fs.constants.F_OK);
          return true;
        } catch {
          return false;
        }
      }

      if (await fileExists(LOCK_FILE)) {
        await log('Outra instância já está rodando');
        process.exit(0);
      }
      try {
        await lockfile.unlock(STATE_FILE);
      } catch (e) {
        // Se o arquivo de lock não existir, ignora o erro
      }
      await fs.promises.writeFile(LOCK_FILE, process.pid.toString());
      await verifyEnvironmentHealth();
      let state = await get_state();

      const isBusy = await reconcileActiveTasks(state);

      if (isBusy) {
        await log("🚫 IA ocupada. Bloqueando novas tarefas.");
        console.log("Nenhuma tarefa elegível para IA");
        // Garantia de limpeza do lock mesmo em caso de falhas
        try {
          await fs.promises.unlink(LOCK_FILE);
        } catch (e) {
          // Se o arquivo de lock não existir, ignora o erro
        }
        process.exit(0); // Força a saída limpa
      }

      const response = await axios.get(`${API_URL}/api/tasks/next/Jarbas`);
      
      if (!response.data.success || !response.data.task) {
        await log("😴 Nenhuma tarefa nova na fila.");
        console.log("Nenhuma tarefa elegível para IA");
        // Garantia de limpeza do lock mesmo em caso de falhas
        try {
          await fs.promises.unlink(LOCK_FILE);
        } catch (e) {
          // Se o arquivo de lock não existir, ignora o erro
        }
        process.exit(0); // Força a saída limpa
      }

      const task = response.data.task;
      await log(`🎯 Preparando envio para o OpenClaw: [${task.id}] ${task.title}`);

      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
      
      state.active_tasks[task.id] = { startTime: Date.now() };
      await save_state(state);

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
      // Garantia de limpeza do lock mesmo em caso de falhas
      try {
        await fs.promises.unlink(LOCK_FILE);
      } catch (e) {
        // Se o arquivo de lock não existir, ignora o erro
      }
      process.exit(0); // Sucesso total, libera o cron

    } catch (error) {
      // Agora capturamos a STACK inteira, e não só a message (que estava vindo vazia)
      await log(`💥 Erro Fatal: ${error.stack || error.message || error}`);
      console.log("Nenhuma tarefa elegível para IA"); 
      process.exit(1); // Saída de erro
    } finally {
      // Garantia de limpeza do lock mesmo em caso de falhas
      try {
        await fs.promises.unlink(LOCK_FILE);
      } catch (e) {
        // Se o arquivo de lock não existir, ignora o erro
      }
    }
  }

  await run();
}

main().catch(e => {
  console.log("Nenhuma tarefa elegível para IA");
  process.exit(1);
});
