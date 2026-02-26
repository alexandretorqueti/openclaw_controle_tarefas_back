const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
require('dotenv').config();
const net = require('net');
const { spawn } = require('child_process');

// Configurações
const API_URL = 'http://localhost:3001';
const TASKS_DIR = path.join(__dirname, 'pending-tasks');
const STATE_FILE = path.join(__dirname, 'monitor-state.json');
const LOG_FILE = '/home/alexandrebragatorqueti/projetos/jarbas-monitor.log';
const MY_USER_ID = '6bdbe73b-8178-4fd5-987d-50f3b73beb2b'; // ID do Jarbas
const MAX_LOG_LINES = 1000;
const servicesConfig = JSON.parse(process.env.PROJECT_SERVICES || '[]');

const STATUS = {
  IN_PROGRESS: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'
};
const MAX_FAILURES = 3;


/**
 * Tenta conectar em uma porta local. 
 * Retorna true se estiver aberta, false se estiver fechada.
 */
function isPortOpen(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    
    socket.setTimeout(2000); // 2 segundos de timeout máximo
    
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
    
    socket.connect(port, '127.0.0.1');
  });
}


/**
 * Inicia o serviço em background de forma desanexada (detached).
 * Isso garante que, se o script do Jarbas morrer, o Front/Back continuam rodando.
 */
function startService(service) {
  console.log(`[Health Check] 🚀 Iniciando ${service.name} na porta ${service.port}...`);
  
  // Divide o comando (ex: "npm run dev" vira "npm" e ["run", "dev"])
  const [command, ...args] = service.cmd.split(' ');

  const child = spawn(command, args, {
    cwd: service.path,
    detached: true,    // Roda independente do processo principal
    stdio: 'ignore'    // Ignora os logs para não poluir o terminal do Jarbas
  });

  // Libera o processo para rodar em background solto do Node
  child.unref(); 
}

/**
 * Passo 1: Verifica a saúde de todas as portas do ambiente.
 */
async function verifyEnvironmentHealth() {
  console.log('=== PASSO 1: VERIFICANDO SAÚDE DO AMBIENTE ===');
  let environmentHealthy = true;

  for (const service of servicesConfig) {
    const isOpen = await isPortOpen(service.port);
    
    if (isOpen) {
      console.log(`[Health Check] ✅ ${service.name} (Porta ${service.port}) está SAUDÁVEL.`);
    } else {
      console.log(`[Health Check] 🔴 ${service.name} (Porta ${service.port}) está OFFLINE. Iniciando recuperação...`);
      startService(service);
      environmentHealthy = false;
    }
  }

  // Se algum serviço teve que ser iniciado, damos um tempinho para eles subirem
  if (!environmentHealthy) {
    console.log('[Health Check] ⏳ Aguardando 5 segundos para os serviços subirem...');
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  console.log('=== FIM DO PASSO 1 ===\n');
  return true;
}

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
    projetoRegras = projRes.data?.regras || projetoRegras;
    log(`[INFO] Regras do projeto ${task.projectId}: ${projetoRegras !== "Nenhuma regra específica definida." ? "ENCONTRADAS" : "NÃO ENCONTRADAS"}`);
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

// === NOVA LÓGICA DE INICIALIZAÇÃO ===
async function start() {
  try {
    // 1. PRIMEIRO: Verifica e garante a saúde das portas
    await verifyEnvironmentHealth();
    
    // 2. SEGUNDO: Só depois que as portas estiverem OK, inicia o fluxo da IA
    await monitorTasks();
    
  } catch (error) {
    console.error(`[FALHA FATAL] O script parou antes de iniciar: ${error.message}`);
  }
}

// Dispara a inicialização
start();



//Funções Auxiliares
/**
 * Lida com tarefas que deram Timeout ou Crasharam
 */
async function handleCrashedTask(task, state, logFile, reason) {
  // Lê o que a IA conseguiu cuspir no log antes de morrer (se existir)
  let partialLog = "Nenhum log foi gerado.";
  if (fs.existsSync(logFile)) {
    partialLog = fs.readFileSync(logFile, 'utf8');
  }

  try {
    // 1. Avisa na API o que houve
    await axios.post(`${API_URL}/api/comments`, {
      taskId: task.id,
      userId: MY_USER_ID,
      content: `⚠️ **FALHA NA EXECUÇÃO DO JARBAS**\n**Motivo:** ${reason}\n\n**Últimos logs capturados:**\n\`\`\`bash\n${partialLog.slice(-2000)}\n\`\`\``
    });

    // 2. Coloca em um status de "Bloqueado" ou devolve para o Alexandre
    // Exemplo: Devolvendo para a fila ou bloqueando
    await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.BLOCKED });

    // 3. Move os arquivos para a pasta 'error' para você debugar depois e limpar a fila
    fs.renameSync(path.join(TASKS_DIR, `prompt-${task.id}.txt`), path.join(ERROR_DIR, `prompt-${task.id}.txt`));
    fs.renameSync(path.join(TASKS_DIR, `execute-${task.id}.sh`), path.join(ERROR_DIR, `execute-${task.id}.sh`));
    if (fs.existsSync(logFile)) fs.renameSync(logFile, path.join(ERROR_DIR, `result-${task.id}.log`));

    // 4. Limpa do estado
    delete state.active_tasks[task.id];
    save_state(state);

    console.log(`[RECUPERAÇÃO] Tarefa ${task.id} movida para Bloqueado e arquivos isolados em /error.`);
  } catch (e) {
    console.error(`[ERRO CRÍTICO] Falha ao processar o crash da tarefa:`, e.message);
  }
}

/**
 * Cria os arquivos físicos e spawna o agente em background
 */
async function spawnNewAgent(task, state, promptFile, scriptFile, logFile) {
  // 1. Gera o arquivo de Texto (Contexto)
  const promptContent = `TÍTULO: ${task.title}\nDESCRIÇÃO: ${task.description}\nREGRAS OBRIGATÓRIAS: ...`;
  fs.writeFileSync(promptFile, promptContent);

  // 2. Gera o arquivo .sh com a inteligência de se auto-mover em caso de sucesso!
  const scriptContent = `#!/bin/bash
echo "Iniciando Jarbas para tarefa ${task.id}..." > "${logFile}"

# Chama o OpenClaw, lê do promptFile e anexa a saída no logFile
openclaw sessions spawn --task "$(cat "${promptFile}")" --label "Jarbas-${task.id}" --agent-id main --mode run >> "${logFile}" 2>&1

# O $? pega o código de saída do comando anterior. 0 significa Sucesso absoluto.
if [ $? -eq 0 ]; then
    echo "Agente terminou com sucesso. Movendo para /processed" >> "${logFile}"
    mv "${promptFile}" "${PROCESSED_DIR}/"
    mv "${scriptFile}" "${PROCESSED_DIR}/"
    mv "${logFile}" "${PROCESSED_DIR}/"
else
    # Se falhar, não move! O Node.js vai perceber o crash no próximo ciclo.
    echo "Falha na execução do agente (Exit code $?)." >> "${logFile}"
fi
`;
  
  fs.writeFileSync(scriptFile, scriptContent);
  fs.chmodSync(scriptFile, '755'); // Dá permissão de execução

  // 3. Executa o arquivo .sh de forma desanexada
  const subprocess = spawn(scriptFile, [], {
    detached: true,
    stdio: 'ignore'
  });

  subprocess.unref(); // Solta o processo para não prender o Node

  // 4. Registra no arquivo de estado
  state.active_tasks = state.active_tasks || {};
  state.active_tasks[task.id] = {
    pid: subprocess.pid,
    startTime: Date.now()
  };
  save_state(state);

  // 5. Atualiza o status na API
  await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
  console.log(`[DISPARADO] Agente em execução. PID: ${subprocess.pid}`);
}

/**
 * Função utilitária para checar se o PID está rodando no Linux/Windows
 */
function isPidRunning(pid) {
  if (!pid) return false;
  try {
    process.kill(pid, 0); // O sinal 0 não mata, apenas testa a existência
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Processa a Tarefa da Vez
 */
async function processCurrentTask(task, state) {
  console.log(`\n=== AVALIANDO TAREFA DA VEZ: [${task.id}] ${task.title} ===`);

  // Define os caminhos dos arquivos baseados no ID da tarefa
  const promptFile = path.join(TASKS_DIR, `prompt-${task.id}.txt`);
  const scriptFile = path.join(TASKS_DIR, `execute-${task.id}.sh`);
  const logFile = path.join(TASKS_DIR, `result-${task.id}.log`);
  
  const processedLogFile = path.join(PROCESSED_DIR, `result-${task.id}.log`);

  // =====================================================================
  // CENÁRIO 1: A TAREFA JÁ FOI PROCESSADA COM SUCESSO
  // =====================================================================
  if (fs.existsSync(processedLogFile)) {
    console.log(`[STATUS] Tarefa já está na pasta 'processed'. Finalizando...`);
    
    // 1. Lê a saída do log gerado pela IA
    const logOutput = fs.readFileSync(processedLogFile, 'utf8');
    
    try {
      // 2. Coloca o log no comentário da tarefa
      await axios.post(`${API_URL}/api/comments`, {
        taskId: task.id,
        userId: MY_USER_ID,
        content: `✅ **Tarefa concluída pelo Jarbas!**\n\n**Log de Execução:**\n\`\`\`bash\n${logOutput.substring(0, 3000)}\n\`\`\`` 
        // substring limita o tamanho para não quebrar o banco se o log for gigante
      });

      // 3. Coloca a tarefa como finalizada
      await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.COMPLETED });
      
      console.log(`[SUCESSO] Tarefa ${task.id} finalizada na API.`);
      
      // Limpa do estado para não monitorar mais
      delete state.active_tasks[task.id];
      save_state(state);
    } catch (error) {
      console.error(`[ERRO] Falha ao atualizar API para a tarefa concluída:`, error.message);
    }
    return;
  }

  // =====================================================================
  // CENÁRIO 2: A TAREFA ESTÁ EM PENDING (INICIADA)
  // =====================================================================
  if (fs.existsSync(scriptFile)) {
    const taskState = state.active_tasks[task.id];

    // Se não tem estado mapeado mas o arquivo existe, o script Node reiniciou e perdeu o rastro
    if (!taskState || !taskState.pid) {
      console.log(`[ALERTA] Tarefa órfã detectada. Arquivos existem, mas nenhum processo mapeado.`);
      await handleCrashedTask(task, state, logFile, "Processo perdeu o rastreamento (Orphaned).");
      return;
    }

    const isRunning = isPidRunning(taskState.pid);
    const timeElapsed = Date.now() - taskState.startTime;

    // Sub-cenário A: Processo ESTÁ rodando
    if (isRunning) {
      if (timeElapsed > TASK_TIMEOUT_MS) {
        console.log(`[TIMEOUT] A tarefa está rodando há mais de 1 hora! Matando processo PID: ${taskState.pid}`);
        try {
          process.kill(taskState.pid, 'SIGKILL'); // Força a morte do processo
        } catch (e) { /* Ignora se já morreu milissegundos antes */ }
        
        await handleCrashedTask(task, state, logFile, `Timeout excedido (${Math.round(timeElapsed/60000)} minutos).`);
      } else {
        console.log(`[AGUARDANDO] A IA está trabalhando nesta tarefa (PID ${taskState.pid}, Tempo: ${Math.round(timeElapsed/60000)}m). Pulando...`);
      }
      return;
    } 
    
    // Sub-cenário B: Processo NÃO ESTÁ rodando, mas não foi pra 'processed'
    else {
      console.log(`[FALHA DETECTADA] O processo ${taskState.pid} morreu ou crashou silenciosamente!`);
      await handleCrashedTask(task, state, logFile, "O agente do OpenClaw crashou ou retornou erro (Exit Code != 0).");
      return;
    }
  }

  // =====================================================================
  // CENÁRIO 3: É UMA TAREFA TOTALMENTE NOVA
  // =====================================================================
  console.log(`[NOVA] Gerando arquivos e spawnando agente...`);
  await spawnNewAgent(task, state, promptFile, scriptFile, logFile);
}