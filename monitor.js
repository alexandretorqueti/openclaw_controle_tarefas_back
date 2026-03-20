#!/usr/bin/env node
// Inicializa o container de injeção de dependências
require('./src/bootstrap');

// monitor.js (Arquitetura Modularizada)
// Orquestrador de tarefas refatorado com servicos especializados
const  { log } = require('./aux/logger');
const axios = require('axios');
const path = require('path');
axios.defaults.timeout = 180000; // 3 minutos

// Novos imports para roteamento inteligente
const prisma = require('./src/services/prismaService');
const validationService = require('./src/services/validationService');
const decompositionService = require('./src/services/decompositionService');
const commentService = require('./src/services/commentService');
const { extractJsonObjects } = require('./src/utils/jsonUtils');
const taskService = require('./src/services/taskService');
const { agent } = require('supertest');

let UserIdJarbas = null;
/**
 * Busca a próxima tarefa elegível para processamento
 * @returns {Promise<Object|null>} Tarefa ou null se não houver
 */
/**
 * Busca a próxima tarefa elegível para processamento via API
 * @param {string} nickname - Nickname do usuário (ex: 'alexandre')
 * @returns {Promise<Object|null>} Tarefa ou null se não houver
 */
async function getNextEligibleTask(nickname) {
  const { getNextTask } = require('./src/steps/adapters/legacyGetNextTask');
  return await getNextTask(nickname, require('./aux/config').API_URL);
}

/**
 * Chama o analista (via OpenClaw) para decompor uma tarefa complexa em micro-tarefas
 * @param {Object} task - Tarefa mãe a ser decomposta
 * @returns {Promise<Object>} Resultado da decomposição
 */
async function callAnalyst(task) {
  const { callAnalyst: legacyCallAnalyst } = require('./src/steps/adapters/legacyCallAnalyst');
  return await legacyCallAnalyst(task);
}

/**
 * Adiciona um comentário a uma tarefa
 * @param {string} taskId - ID da tarefa
 * @param {string} content - Conteúdo do comentário
 */
async function addComment(taskId, content) {
  const { addComment: legacyAddComment } = require('./src/steps/adapters/legacyAddComment');
  return await legacyAddComment(taskId, content, UserIdJarbas);
}

async function main() {
  // Configuracoes
  const { API_URL, STATUS, TASKS_DIR, PROCESSED_DIR, ERROR_DIR, LOCK_FILE, MY_USER_NICKNAME, TASK_TIMEOUT_MS } = require('./aux/config');

  // Servicos modularizados
  const LockService = require('./src/services/lockService');
  const MonitorStateService = require('./src/services/monitorStateService');
  let TaskExecutionService;
  try {
    TaskExecutionService = require('./src/services/taskExecutionService');
  } catch (err) {
    console.error("🔥 ERRO FATAL AO CARREGAR O SERVIÇO:", err);
    debugger; // O seu debug vai PAUSAR AQUI, e você poderá inspecionar a variável 'err'
  }
  const TaskFileService = require('./src/services/taskFileService');

  // Utilitarios
  const { segundosToMinutos_Segundos } = require('./src/utils/timeUtils');

  // Instancias de servicos
  const lockService = new LockService(LOCK_FILE);
  const stateService = new MonitorStateService(TASKS_DIR);
  
  // Variavel de escopo global para as funcoes auxiliares acessarem
  let MY_USER_ID = null;

/**
   * Verifica timeout de tarefas ativas e executa acao de recuperacao (Kill + Move)
   * @param {number} pid - PID do processo associado ao lock
   */
  async function handleTaskTimeoutCheck(pid) {
    const { handleTaskTimeoutCheck: legacyHandleTaskTimeoutCheck } = require('./src/steps/adapters/legacyTaskTimeoutCheck');
    return await legacyHandleTaskTimeoutCheck(pid, { TASK_TIMEOUT_MS, TASKS_DIR, ERROR_DIR });
  }

  /**
   * Trata falha na execucao de uma tarefa
   */
  async function handleTaskFailure(task, error) {
    const { handleTaskFailure: legacyHandleTaskFailure } = require('./src/steps/adapters/legacyTaskFailure');
    return await legacyHandleTaskFailure(task, error, MY_USER_ID, { API_URL, TASKS_DIR, ERROR_DIR });
  }

  /**
   * Trata sucesso na execucao de uma tarefa
   */
  async function handleTaskSuccess(task, executionResult) {
    const { handleTaskSuccess: legacyHandleTaskSuccess } = require('./src/steps/adapters/legacyTaskSuccess');
    return await legacyHandleTaskSuccess(task, executionResult, MY_USER_ID, { API_URL, TASKS_DIR, PROCESSED_DIR });
  }

  /**
   * Funcao principal de execucao
   */
  async function run() {
    // 1. Controle de Concorrencia (Passando o threshold para o Requisito 2)
    const lockCheck = await lockService.checkLock(TASK_TIMEOUT_MS);
    
    if (lockCheck.locked) {
      if (lockCheck.ageRecent) {
        await log(`🔒 Lock recente (${segundosToMinutos_Segundos((Date.now() - lockCheck.mtime)/1000)}). Mantendo execução atual.`);
        return;
      }
      
      await log(`🔒 Lock antigo/ativo detectado. PID ${lockCheck.pid} está sendo verificado.`);
      await handleTaskTimeoutCheck(lockCheck.pid);
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
    
    try {
      // Busca dados do usuario pelo nickname para usar ao longo do ciclo de vida da tarefa
      try {
        const usersRes = await axios.get(`${API_URL}/api/users`);
        const user = (usersRes.data.users || []).find(u => u.nickname === MY_USER_NICKNAME);
        if (user) {
          MY_USER_ID = user.id;
          UserIdJarbas = user.id;
        } else {
          await log(`⚠️ Usuario '${MY_USER_NICKNAME}' nao encontrado na API. Operacoes que exigem ID podem falhar.`);
        }
      } catch (userError) {
        await log(`⚠️ Falha ao buscar configuracoes de usuario: ${userError.message}`);
      }

      // 2. Busca nova tarefa (REFATORADO - Query Prisma)
      const task = await getNextEligibleTask(MY_USER_NICKNAME);
      
      if (!task) {
        await log(`🔍 Nenhuma tarefa disponível.`);
        return;
      }

      await log(`🎯 Tarefa capturada: [${task.id}] ${task.title}`);
      
      // Adquirir lock passando o taskId - o lockService agora marca isExecuting: true automaticamente
      if (!await lockService.acquireLock(task.id)) {
        await log(`❌ Falha ao adquirir lock.`);
        return;
      }
      
      // Registrar tarefa como ativa
      await stateService.registerActiveTask(task.id);
      
      // Buscar ID do status "Em Andamento"
      let STATUS_ID = null;
      try {
        const statusResponse = await axios.get(`${API_URL}/api/statuses`);
        if (statusResponse.data && statusResponse.data.statuses) {
          const inProgressStatus = statusResponse.data.statuses.find(s => s.name === STATUS.IN_PROGRESS);
          STATUS_ID = inProgressStatus ? inProgressStatus.id : null;
        }
      } catch (error) {
        console.error('Erro ao buscar status:', error.message);
        STATUS_ID = null;
      }
      
      // Atualizar status para "Em Andamento" se encontrou o ID
      if (STATUS_ID) {
        await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS_ID });
      } else {
        await log(`⚠️ Não foi possível encontrar o status "${STATUS.IN_PROGRESS}" para atualizar a tarefa ${task.id}`);
      }

      // 3. LÓGICA DE ROTEAMENTO (NOVO)
      let routingResult = null;
      
      if (!task.domain) {
        // CASO 1: Sem domínio → Analista
        await log(`🔍 Tarefa sem domínio. Chamando Analista...`);
        routingResult = await callAnalyst(task);
        
      } else if (!task.isAtomic) {
        // CASO 2: Com domínio mas não atômica → Validador
        await log(`⚖️ Tarefa não atômica. Validando...`);
        
        try {
          // Validar com modelo auxiliar
          const validation = await validationService.validateWithAuxModel(task, task.project);
          
          // Atualizar atomicidade no banco
          await taskService.updateTask(task.id, { isAtomic: validation.isAtomic });
          if (!validation.isAtomic) {
            // Manda pro Analista
            routingResult = await callAnalyst(task);
          } else {
            await log(`✅ Tarefa ${task.id} validada como atômica. Prosseguindo para execução...`);
            // Tarefa agora é atômica, cair no caso 3
            task.isAtomic = true;
          }
        } catch (validationError) {
          await log(`💥 Erro na validação: ${validationError.message}`);
          routingResult = { success: false, error: validationError.message };
        }
      }
      
      // CASO 3: Tarefa atômica (ou foi validada como atômica) → Executar com Programador
      if (task.domain && task.isAtomic && (!routingResult || routingResult.success)) {
        await log(`🚀 Tarefa atômica. Executando...`);
        
        // Determinar agente baseado no domínio (CORREÇÃO: usar === em vez de =)
        let agent;
        if (task.domain === 'BACKEND') {
          agent = task.project.programadorBack;
        } else if (task.domain === 'FRONTEND') {
          agent = task.project.programadorFront;
        } else {
          throw new Error(`Domínio inválido: ${task.domain}`);
        }
        
        // Fallback se não houver programador configurado
        if (!agent) {
          agent = task.domain === 'BACKEND' ? 'default-backend-agent' : 'default-frontend-agent';
          await log(`⚠️ Usando agente padrão para ${task.domain}: ${agent}`);
        }
        
        await log(`👨‍💻 Executando tarefa ${task.id} com ${agent} (${task.domain})`);
        
        // Configuração para execução
        const config = {
          TASKS_DIR,
          TASK_TIMEOUT_MS,
          MY_USER_ID,
          agent // Novo parâmetro passado para o serviço
        };
        
        // Executar tarefa
        const { executeTask: legacyExecuteTask } = require('./src/steps/adapters/legacyExecuteTask');
        const executionResult = await legacyExecuteTask(task, MY_USER_ID, config);
        
        // Processar resultado
        if (executionResult.success) {
          await handleTaskSuccess(task, executionResult);
        } else {
          await handleTaskFailure(task, new Error(executionResult.errorMessage || 'Execução falhou'));
        }
      } else if (routingResult && !routingResult.success) {
        // Tratar erro no roteamento
        await log(`❌ Erro no roteamento: ${routingResult.error}`);
        await handleTaskFailure(task, new Error(`Roteamento falhou: ${routingResult.error}`));
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
      await lockService.releaseLock();
    }
  }
  //await log("🚀 Iniciando monitor de tarefas...");

  await run();
}

// Exporta para testes
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { main };

