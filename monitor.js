#!/usr/bin/env node
// monitor.js (Arquitetura Modularizada)
// Orquestrador de tarefas refatorado com servicos especializados

async function main() {
  const axios = require('axios');
  const path = require('path');
  
  axios.defaults.timeout = 60000;

  // Configuracoes
  const { API_URL, STATUS, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, LOCK_FILE, MY_USER_NICKNAME, TASK_TIMEOUT_MS } = require('./aux/config');
  const { log } = require('./aux/logger');

  // Servicos modularizados
  const LockService = require('./src/services/lockService');
  const MonitorStateService = require('./src/services/monitorStateService');
  const TaskExecutionService = require('./src/services/taskExecutionService');
  const TaskFileService = require('./src/services/taskFileService');

  // Utilitarios
  const { segundosToMinutos_Segundos } = require('./src/utils/timeUtils');

  // Instancias de servicos
  const lockService = new LockService(LOCK_FILE);
  const stateService = new MonitorStateService(TASKS_DIR);
  
  // Variavel de escopo global para as funcoes auxiliares acessarem
  let MY_USER_ID = null;

  /**
   * Verifica timeout de tarefas ativas e executa acao de recuperacao
   */
  async function handleTaskTimeoutCheck() {
    const activeTasks = await stateService.getActiveTasks();
    const taskIds = Object.keys(activeTasks);
    
    if (taskIds.length === 0) return;

    const now = Date.now();
    const taskId = taskIds[0];
    const task = activeTasks[taskId];
    const elapsed = now - task.startTime;

    await log(`⏱️ Tarefa ${taskId} em execucao por ${segundosToMinutos_Segundos(elapsed / 1000)}.`);

    // Logica do ceifador (self-healing)
    if (elapsed > TASK_TIMEOUT_MS + 30000) {
      await log(`🧟 ZUMBIFICADO: A instancia anterior travou completamente. Forcando limpeza de emergencia!`);
      
      const lockCheck = await lockService.checkLock();
      if (lockCheck.pid) {
        await lockService.killAndRelease(lockCheck.pid);
      }
      
      await stateService.cleanupTask(taskId);
      await log(`🧹 Cadeado quebrado a forca. O proximo ciclo do Cron assumira a fila.`);
    }
  }

  /**
   * Trata falha na execucao de uma tarefa
   */
  async function handleTaskFailure(task, error) {
    await log(`⚠️ ALERTA: Falha na execucao da tarefa ${task.id}: ${error.message}`);
    
    const { fileExists } = require('./src/utils/fileUtils');
    const terminalLogPath = path.join(TASKS_DIR, `terminal-${task.id}.log`);
    let terminalOutput = "";
    
    if (await fileExists(terminalLogPath)) {
      const fs = require('fs').promises;
      terminalOutput = await fs.readFile(terminalLogPath, 'utf8');
    }

    // Adiciona comentario sobre a falha se tivermos o ID do usuario
    if (MY_USER_ID) {
      try {
        await axios.post(`${API_URL}/api/comments`, {
          taskId: task.id,
          userId: MY_USER_ID,
          content: `⚠️ **FALHA DE EXECUCAO LOCAL**\nErro: ${error.message}\n\nSaida do Terminal:\n${terminalOutput.substring(0, 1000)}`
        });
      } catch (e) {
        await log(`❌ Erro ao postar comentario de falha: ${e.message}`);
      }
    }
    
    // Tenta reatribuir para o desenvolvedor
    try {
      const usersRes = await axios.get(`${API_URL}/api/users`);
      const dev = (usersRes.data.users || []).find(u => u.nickname === 'alexandre');
      
      if (dev) {
        await log(`👤 Reatribuindo tarefa ${task.id} para o usuario alexandre.`);
        await axios.put(`${API_URL}/api/tasks/${task.id}`, { assignedToId: dev.id });
      } else {
        await log(`⚠️ Usuario 'alexandre' nao encontrado na API`);
      }
    } catch (assignError) {
      await log(`❌ Erro de rede ao tentar reatribuir a tarefa: ${assignError.message}`);
    }
    
    await TaskFileService.moveTaskFiles(task.id, TASKS_DIR, ERROR_DIR);
    await stateService.cleanupTask(task.id);
  }

  /**
   * Trata sucesso na execucao de uma tarefa
   */
  async function handleTaskSuccess(task, executionResult) {
    await log(`✅ Tarefa ${task.id} executada com sucesso!`);
    
    // Atualiza status da tarefa
    if (MY_USER_ID) {
      try {
        await axios.patch(`${API_URL}/api/tasks/${task.id}/finalize`, {
          userId: MY_USER_ID,
          executionNotes: executionResult.executionNotes
        });
      } catch (e) {
        await log(`❌ Erro ao finalizar a tarefa na API: ${e.message}`);
      }
    } else {
      await log(`⚠️ Nao foi possivel finalizar tarefa na API pois MY_USER_ID é nulo.`);
    }

    await TaskFileService.moveTaskFiles(task.id, TASKS_DIR, PROCESSED_DIR);
    await stateService.cleanupTask(task.id);
  }

  /**
   * Funcao principal de execucao
   */
  async function run() {
    console.error('🚀 Iniciando Orquestrador Node.js (Arquitetura Modularizada)...');

    // 1. Controle de Concorrencia (Lock)
    const lockCheck = await lockService.checkLock();
    
    if (lockCheck.locked) {
      await handleTaskTimeoutCheck();
      await log(`⏳ Outra instancia ja esta rodando com PID ${lockCheck.pid}. Omitindo execucao.`);
      return;
    }

    if (lockCheck.corrupted) {
      await log(`⚠️ Lock com PID invalido. Limpando lock corrompido.`);
      await lockService.forceReleaseLock();
    } else if (lockCheck.pid && !lockCheck.alive) {
      await log(`🧹 Lock orfao detectado. PID ${lockCheck.pid} nao existe mais. Limpando lock e estado.`);
      await lockService.forceReleaseLock();
      await stateService.clearState();
    }
    
    if (!await lockService.acquireLock()) {
      await log(`❌ Falha ao adquirir lock.`);
      return;
    }
    
    await log(`🔓 Lock trancado com sucesso.`);

    try {
      // Busca dados do usuario pelo nickname para usar ao longo do ciclo de vida da tarefa
      try {
        const usersRes = await axios.get(`${API_URL}/api/users`);
        const user = (usersRes.data.users || []).find(u => u.nickname === MY_USER_NICKNAME);
        if (user) {
          MY_USER_ID = user.id;
        } else {
          await log(`⚠️ Usuario '${MY_USER_NICKNAME}' nao encontrado na API. Operacoes que exigem ID podem falhar.`);
        }
      } catch (userError) {
        await log(`⚠️ Falha ao buscar configuracoes de usuario: ${userError.message}`);
      }

      // 2. Busca nova tarefa
      const address = `${API_URL}/api/tasks/next/Jarbas`;
      log(`🔍 Consultando proxima tarefa na fila: ${address}`);
      const response = await axios.get(address);
      
      if (!response.data.success || !response.data.task) {
        console.error("😴 Nenhuma tarefa nova na fila.");
        return;
      }

      const task = response.data.task;
      await log(`🎯 Tarefa capturada: [${task.id}] ${task.title}. Assumindo o controle...`);
      
      await stateService.registerActiveTask(task.id);
      
      // Atualiza status para "Em Andamento"
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });

      // 3. Executa a tarefa usando o servico
      const config = {
        TASKS_DIR,
        TASK_TIMEOUT_MS,
        MY_USER_ID // Passando para dentro do TaskExecutionService caso necessario
      };

      await log(`🤖 Executando tarefa via TaskExecutionService...`);
      
      const executionResult = await TaskExecutionService.executeTask(task, MY_USER_ID, config);

      // 4. Processa resultado
      if (executionResult.success) {
        await handleTaskSuccess(task, executionResult);
      } else {
        await handleTaskFailure(task, new Error(executionResult.errorMessage || 'Execucao falhou'));
      }

    } catch (error) {
      const detail = error.response?.data 
        ? JSON.stringify(error.response.data) 
        : (error.stack || error.message);
        
      const requestInfo = error.config 
        ? `[${error.config.method.toUpperCase()} ${error.config.url}]` 
        : '';

      await log(`💥 Erro Fatal no Orquestrador ${requestInfo}: ${detail}`);
      
      await lockService.releaseLock();
      process.exitCode = 1;
    } finally {
      const released = await lockService.releaseLock();
      if (released) {
        await log(`🔓 Lock liberado com sucesso.`);
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