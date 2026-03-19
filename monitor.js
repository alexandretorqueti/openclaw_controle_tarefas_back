#!/usr/bin/env node
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
  // Importando a configuração localmente caso não esteja no topo do arquivo
  const { API_URL } = require('./aux/config'); 

  try {
    
    const response = await axios.get(`${API_URL}/api/users/nickname/${nickname}/next-task`);

    // Se a API retornar uma tarefa válida, nós a devolvemos
    if (response.data && response.data?.task.id) {
      return response.data.task;
    }

    return null;
  } catch (error) {
    // Se a API retornar 404 (Not Found) ou 204 (No Content), significa que a fila está vazia.
    // Isso é um comportamento esperado, então não precisamos logar como um erro crítico.
    if (error.response && (error.response.status === 404 || error.response.status === 204)) {
      return null;
    }

    // await log(`❌ Erro ao buscar tarefa elegível na API: ${error.message}`);
    return null;
  }
}

/**
 * Chama o analista (via OpenClaw) para decompor uma tarefa complexa em micro-tarefas
 * @param {Object} task - Tarefa mãe a ser decomposta
 * @returns {Promise<Object>} Resultado da decomposição
 */
async function callAnalyst(task) {
  const OpenClawService = require('./src/services/openclawService');
  const PromptFactory = require('./src/utils/promptFactory'); // <-- Importando sua Factory
  const path = require('path');
  const fs = require('fs').promises;
  const { TASKS_DIR, TASK_TIMEOUT_MS } = require('./aux/config');

  try {
    await log(`🔍 Chamando Arquiteto (OpenClaw) para decompor tarefa ${task.id}: ${task.title}`);

    // Importar utilitário de sessões em cadeia
    const SessionChainUtils = require('./src/utils/sessionChainUtils');
    
    // Usar sessão unificada baseada na cadeia de dependências
    const architectSessionId = await SessionChainUtils.generateUnifiedSessionId(task.id, 'arquiteto');
    
    await log(`🔗 Sessão do arquiteto (decomposição): ${architectSessionId}`);
    const architectLogFile = path.join(TASKS_DIR, `architect-${task.id}.log`);

    const primaryAgent = task.project?.agent ||  task.project?.programadorBack || 'main';
    const fallbackAgent = task.project?.programadorFront || 'main';

    // Usando o seu PromptFactory de forma limpa
    const architectInput = PromptFactory.buildDecompositionPrompt(task);

    const architectResult = await OpenClawService.executeWithFallback(
      architectSessionId,
      architectInput,
      primaryAgent,
      fallbackAgent,
      task.project?.modeloAuxiliar || null,
      TASKS_DIR,
      architectLogFile,
      task.project?.pastaBase,
      TASK_TIMEOUT_MS
    );

    if (!architectResult.success) {
      throw new Error(`Falha na execução do OpenClaw: ${architectResult.errorMessage}`);
    }

    // Extrai o JSON do rawOutput
    let subtasksPlan = [];
    try {
      const jsonMatch = architectResult.rawOutput.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) throw new Error("Nenhum array JSON encontrado na saída do agente.");
      
      
      subtasksPlan = JSON.parse(architectResult.rawOutput);
    } catch (parseError) {
      try {
        // Tenta de novo com a função extractJson
        subtasksPlan = extractJsonObjects(architectResult.rawOutput);  
      } catch (extractError) {
        throw new Error(`Falha ao extrair o JSON da saída do OpenClaw: ${extractError.message}`);
      }
    }

    if (!Array.isArray(subtasksPlan) || subtasksPlan.length === 0) {
      throw new Error("O Arquiteto retornou um array vazio de tarefas.");
    }

    const mappedSubtasks = subtasksPlan.map(st => ({
      title: st.title,
      description: st.description,
      domain: st.domain, 
      projectId: task.projectId,
      statusId: task.statusId,
      priorityId: task.priorityId,
      userId: task.assignedToId
    }));
    
    const decompositionResult = await decompositionService.decompose(task.id, mappedSubtasks);
    
    await addComment(task.id, `🔍 **Análise Concluída pelo Arquiteto**\nA funcionalidade foi dividida em ${mappedSubtasks.length} micro-tarefas sequenciais.`);
    await log(`✅ Tarefa ${task.id} decomposta pelo OpenClaw em ${mappedSubtasks.length} subtarefas.`);
    
    return { success: true, subtasksCreated: mappedSubtasks.length };
    
  } catch (error) {
    await log(`💥 Erro ao chamar Arquiteto para tarefa ${task.id}: ${error.message}`);
    await addComment(task.id, `❌ **Erro na Análise**\nFalha ao decompor tarefa: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/**
 * Adiciona um comentário a uma tarefa
 * @param {string} taskId - ID da tarefa
 * @param {string} content - Conteúdo do comentário
 */
async function addComment(taskId, content) {
  try {
    await commentService.createComment({
      taskId,
      userId: UserIdJarbas,
      content
    });
  } catch (error) {
    await log(`⚠️ Erro ao adicionar comentário: ${error.message}`);
  }
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
    const activeTasks = await stateService.getActiveTasks();
    const taskIds = Object.keys(activeTasks);
    
    if (taskIds.length === 0) return;

    const now = Date.now();
    const taskId = taskIds[0];
    const task = activeTasks[taskId];
    const elapsed = now - task.startTime;
    
    const GRACE_PERIOD_MS = 60000; // 1 minuto de carência após o timeout

    await log(`⏱️ Tarefa ${taskId} em execucao por ${segundosToMinutos_Segundos(elapsed / 1000)}.`);

    // REQUISITO 1 & 3: Só mata se passar de 1 minuto depois do timeout
    if (elapsed > TASK_TIMEOUT_MS + GRACE_PERIOD_MS) {
      await log(`💀 CEIFADOR: Tarefa ${taskId} excedeu o limite crítico (Timeout + 1m).`);
      await log(`⚰️ Encerrando processo ${pid}, desbloqueando sistema e movendo arquivos para ERROR.`);

      [cite_start]// Mata o processo e remove o arquivo de lock [cite: 4953, 4958]
      await lockService.killAndRelease(pid);
      
      [cite_start]// Move arquivos para a pasta de erro [cite: 5698]
      await TaskFileService.moveTaskFiles(taskId, TASKS_DIR, ERROR_DIR);
      
      [cite_start]// Limpa o estado interno [cite: 5687]
      await stateService.cleanupTask(taskId);
      
      await log(`🧹 Sistema recuperado. O próximo ciclo poderá assumir a fila.`);
    } 
    else if (elapsed > TASK_TIMEOUT_MS) {
      await log(`⚠️ ALERTA: Tarefa ${taskId} excedeu o tempo limite original. Aguardando carência de 1 minuto antes de intervir.`);
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
    
    // Em caso de erro, tentar desmarcar a tarefa como em execução
    try {
      await axios.put(`${API_URL}/api/tasks/${task.id}/finish-execution`);
      await log(`⚠️ Tarefa "${task.title}" desmarcada após erro (isExecuting: false)`);
    } catch (cleanupError) {
      await log(`❌ Erro ao limpar estado de execução: ${cleanupError.message}`);
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

    // Marcar tarefa como finalizada (isExecuting: false)
    try {
      await axios.put(`${API_URL}/api/tasks/${task.id}/finish-execution`);
      await log(`✅ Tarefa "${task.title}" marcada como finalizada no sistema (isExecuting: false)`);
    } catch (error) {
      await log(`❌ Erro ao marcar tarefa como finalizada: ${error.message}`);
      // Continuar mesmo com erro - não é crítico
    }

    await TaskFileService.moveTaskFiles(task.id, TASKS_DIR, PROCESSED_DIR);
    await stateService.cleanupTask(task.id);
  }

  /**
   * Funcao principal de execucao
   */
  async function run() {
    // 1. Controle de Concorrencia (Passando o threshold para o Requisito 2)
    const lockCheck = await lockService.checkLock(TASK_TIMEOUT_MS);
    
    if (lockCheck.locked) {
      if (lockCheck.ageRecent) {
        // await log(`🔒 Lock recente (${segundosToMinutos_Segundos((Date.now() - lockCheck.mtime)/1000)}). Mantendo execução atual.`);
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
    
    if (!await lockService.acquireLock()) {
      await log(`❌ Falha ao adquirir lock.`);
      return;
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
        // await log(`🔍 Nenhuma tarefa disponível.`);
        return;
      }

      await log(`🎯 Tarefa capturada: [${task.id}] ${task.title}`);
      
      // AGORA marcar a tarefa como isExecuting: true (após criar o arquivo LOCK)
      try {
        await axios.put(`${API_URL}/api/tasks/${task.id}`, { isExecuting: true });
        await log(`✅ Tarefa "${task.title}" marcada como em execução (isExecuting: true)`);
      } catch (error) {
        await log(`❌ Erro ao marcar tarefa como em execução: ${error.message}`);
        // Continuar mesmo com erro - não é crítico
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
          await prisma.task.update({
            where: { id: task.id },
            data: { isAtomic: validation.isAtomic }
          });
          
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
        const executionResult = await TaskExecutionService.executeTask(task, MY_USER_ID, config);
        
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

