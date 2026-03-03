// monitor.js (Arquitetura Refatorada - Worker Leve)
async function main() {
  const axios = require('axios');
  const fs = require('fs').promises;
  const path = require('path');
  
  axios.defaults.timeout = 10000;

  const { API_URL, STATUS, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, LOCK_FILE, MY_USER_ID, TASK_TIMEOUT_MS } = require('./aux/config');
  const { log } = require('./aux/logger');
  const { prepareTaskPrompt } = require('./aux/taskUtils'); // Importe a função prepareTaskPrompt do arquivo taskUtils.js

  const fileExists = async (pathToCheck) => {
    try {
      await fs.access(pathToCheck);
      return true;
    } catch {
      return false;
    }
  };

  async function moveTaskFiles(taskId, destinationDir) {
    const files = [
      `prompt-${taskId}.txt`,
      `relatorio-${taskId}.txt`,
      `terminal-${taskId}.log`,
      `done-${taskId}.done`
    ];
    
    for (const file of files) {
      const src = path.join(TASKS_DIR, file);
      const dest = path.join(destinationDir, file);
      if (await fileExists(src)) {
        await fs.rename(src, dest);
      }
    }
  }

  async function cleanupMonitorState(taskId) {
    const stateFilePath = path.join(TASKS_DIR, 'monitor-state.json');
    if (await fileExists(stateFilePath)) {
      const stateContent = await fs.readFile(stateFilePath, 'utf8');
      try {
        const monitorState = JSON.parse(stateContent);
        if (monitorState.active_tasks && monitorState.active_tasks[taskId]) {
          delete monitorState.active_tasks[taskId];
          await fs.writeFile(stateFilePath, JSON.stringify(monitorState, null, 2));
        }
      } catch (e) {
        await log(`⚠️ Erro ao limpar monitor-state.json: ${e.message}`);
      }
    }
  }

  async function manageState(taskId) {
    const stateFilePath = path.join(TASKS_DIR, 'monitor-state.json');
    let monitorState = { active_tasks: {} };
    
    if (await fileExists(stateFilePath)) {
      const stateContent = await fs.readFile(stateFilePath, 'utf8');
      try {
        monitorState = JSON.parse(stateContent);
      } catch (e) {
        await log(`⚠️ Erro ao fazer parse do estado anterior. Criando novo.`);
      }
    }
    
    if (!monitorState.active_tasks) monitorState.active_tasks = {};
    monitorState.active_tasks[taskId] = { startTime: Date.now() };
    
    await fs.writeFile(stateFilePath, JSON.stringify(monitorState, null, 2));
  }

  async function incrementTaskTimerandReturnValue() {
    const stateFilePath = path.join(TASKS_DIR, 'monitor-state.json');
    if (await fileExists(stateFilePath)) {
      const stateContent = await fs.readFile(stateFilePath, 'utf8');
      let state = {};
      try {
        state = JSON.parse(stateContent);
      } catch (e) {
        console.error(`Erro ao ler o arquivo de estado: ${e.message}`);
        return;
      }
      
      const now = Date.now();
      
      try {
        if (state.active_tasks) {
          const taskIds = Object.keys(state.active_tasks);
          if (taskIds.length > 0) {
            const taskId = taskIds[0];
            const startTime = state.active_tasks[taskId].startTime;
            const elapsed = now - startTime;
            
            await log(`⏱️ Tarefa ${taskId} em execução por ${segundosToMinutos_Segundos(elapsed / 1000)}.`);

            // Lógica do ceifador (self-healing)
            if (elapsed > TASK_TIMEOUT_MS + 30000) {
              await log(`🧟 ZUMBIFICADO: A instância anterior travou completamente. Forçando limpeza de emergência!`);
              
              try {
                const pidZumbi = await fs.readFile(LOCK_FILE, 'utf8');
                if (pidZumbi) process.kill(parseInt(pidZumbi), 'SIGKILL');
              } catch (killErr) {
                // Ignora se o processo já não existir mais
              }
              
              await fs.unlink(LOCK_FILE);
              await cleanupMonitorState(taskId);
              await log(`🧹 Cadeado quebrado à força. O próximo ciclo do Cron assumirá a fila.`);
            }
          }
        }
      } catch (e) {
        await log(`❌ Erro ao incrementar o tempo da tarefa: ${e.message}`);
      }
    }
  }

  function segundosToMinutos_Segundos(segundos) {
    const minutos = Math.floor(segundos / 60);
    const segundosRestantes = segundos % 60;
    return `${minutos}m ${segundosRestantes.toFixed(2)}s`;
  }

  async function handleTaskFailure(task, error) {
    await log(`⚠️ ALERTA: Falha na execução da tarefa ${task.id}: ${error.message}`);
    
    const terminalLogPath = path.join(TASKS_DIR, `terminal-${task.id}.log`);
    let terminalOutput = "";
    if (await fileExists(terminalLogPath)) {
      terminalOutput = await fs.readFile(terminalLogPath, 'utf8');
    }

    // Adiciona comentário sobre a falha
    await axios.post(`${API_URL}/api/comments`, {
      taskId: task.id,
      userId: MY_USER_ID,
      content: `⚠️ **FALHA DE EXECUÇÃO LOCAL**\nErro: ${error.message}\n\nSaída do Terminal:\n${terminalOutput.substring(0, 1000)}`
    });
    
    // Tenta reatribuir para o desenvolvedor
    try {
      let devId = null;
      const usersRes = await axios.get(`${API_URL}/api/users`);
      const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
      
      if (dev) {
        devId = dev.id;
        await log(`👤 Reatribuindo tarefa ${task.id} para o usuário alexandre.`);
        await axios.put(`${API_URL}/api/tasks/${task.id}`, { assignedToId: devId });
      } else {
        await log(`⚠️ Usuário 'alexandre' não encontrado na API.`);
      }
    } catch (assignError) {
      await log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
    }
    
    await moveTaskFiles(task.id, ERROR_DIR);
    await cleanupMonitorState(task.id);
  }

  async function handleTaskSuccess(task, executionResult) {
    await log(`✅ Tarefa ${task.id} executada com sucesso!`);
    
    // Atualiza status da tarefa
    await axios.patch(`${API_URL}/api/tasks/${task.id}/finalize`, {
      userId: MY_USER_ID,
      executionNotes: executionResult.executionNotes
    });

    await moveTaskFiles(task.id, PROCESSED_DIR);
    await cleanupMonitorState(task.id);
  }

  async function run() {
    console.error('🚀 Iniciando Orquestrador Node.js (Arquitetura Refatorada)...');

    // 1. Controle de Concorrência (Lock)
    if (await fileExists(LOCK_FILE)) {
      await incrementTaskTimerandReturnValue();
      await log('⏳ Outra instância já está rodando. Omitindo execução.');
      return;
    }
    
    await fs.writeFile(LOCK_FILE, process.pid.toString());
    await log(`🔓 Lock trancado com sucesso.`);

    try {
      // 2. Busca nova tarefa
      const response = await axios.get(`${API_URL}/api/tasks/next/Jarbas`);
      
      if (!response.data.success || !response.data.task) {
        console.error("😴 Nenhuma tarefa nova na fila.");
        return;
      }

      const task = response.data.task;
      await log(`🎯 Tarefa capturada: [${task.id}] ${task.title}. Assumindo o controle...`);
      
      await manageState(task.id);
      
      // Atualiza status para "Em Andamento"
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });

      // 3. Executa a tarefa usando o serviço
      const config = {
        TASKS_DIR,
        TASK_TIMEOUT_MS
      };

      await log(`🤖 Executando tarefa via TaskExecutionService...`);
      const executionResult = await TaskExecutionService.executeTask(task, MY_USER_ID, config);

      // 4. Processa resultado
      if (executionResult.success) {
        await handleTaskSuccess(task, executionResult);
      } else {
        await handleTaskFailure(task, new Error(executionResult.errorMessage || 'Execução falhou'));
      }

    } catch (error) {
      const detail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : (error.stack || error.message);
        
      const requestInfo = error.config 
        ? `[${error.config.method.toUpperCase()} ${error.config.url}]` 
        : '';

      await log(`💥 Erro Fatal no Orquestrador ${requestInfo}: ${detail}`);
      
      // Tenta limpar o lock em caso de erro
      try {
        if (await fileExists(LOCK_FILE)) {
          await fs.unlink(LOCK_FILE);
        }
      } catch (e) {
        console.error(`Erro ao remover lock file: ${e.message}`);
      }
      
      process.exitCode = 1;
    } finally {
      try {
        if (await fileExists(LOCK_FILE)) {
          await fs.unlink(LOCK_FILE);
          await log(`🔓 Lock liberado com sucesso.`);
        }
      } catch (e) {
        console.error(`Erro ao remover lock file: ${e.message}`);
      }
    }
  }

  await run();
}

// Exporta para testes
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { main };