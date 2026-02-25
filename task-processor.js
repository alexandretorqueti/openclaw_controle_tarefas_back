#!/usr/bin/env node
/**
 * TASK-PROCESSOR.JS - Processador automático de tarefas para IA
 * 
 * Funcionalidades:
 * 1. Busca tarefas atribuídas ao Jarbas com status visíveis para IA
 * 2. Cria branches nos repositórios do projeto
 * 3. Spawna agente para executar a tarefa
 * 4. Monitora agentes ativos e timeout (30 minutos)
 * 5. Detecta conclusão e faz commit/push automático
 * 
 * CONFIGURAÇÕES:
 * - IDs são buscados dinamicamente do banco
 * - Status visíveis para IA são buscados da API
 * - Sem fallback hardcoded (erro se não encontrar)
 */

require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec: execCmd } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execCmd);

// ========== CONFIGURAÇÕES ==========
const API_URL = process.env.API_URL || 'http://localhost:3001';
const LOG_FILE = path.join(__dirname, 'task-processor.log');
const STATE_FILE = path.join(__dirname, 'task-processor-state.json');

// IDs serão buscados dinamicamente
let MY_USER_ID = null;      // ID do Jarbas (buscar por nickname 'Jarbas')
let ALEXANDRE_USER_ID = null; // ID do Alexandre (buscar por nickname 'alexandre')

// Estado do processador
let processorState = {
  currentTask: null,
  agentSessionId: null,
  taskStartedAt: null,
  branchesCreated: [],
  lastCheck: null
};

// ========== FUNÇÕES DE LOG ==========
async function log(message) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const logLine = `[${timestamp}] ${message}\n`;
  
  console.log(logLine.trim());
  
  try {
    // Ler log atual
    let logs = [];
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf8');
      logs = content.split('\n').filter(line => line.trim());
    }
    
    // Adicionar nova linha no início (mais recente primeiro)
    logs.unshift(logLine.trim());
    
    // Manter apenas as últimas 1000 linhas
    if (logs.length > 1000) {
      logs = logs.slice(0, 1000);
    }
    
    // Salvar log
    fs.writeFileSync(LOG_FILE, logs.join('\n') + '\n');
  } catch (error) {
    console.error(`Erro ao escrever log: ${error.message}`);
  }
}

// ========== FUNÇÕES DE ESTADO ==========
function loadState() {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const data = fs.readFileSync(STATE_FILE, 'utf8');
      processorState = JSON.parse(data);
      log(`Estado carregado: ${processorState.currentTask ? `Tarefa ${processorState.currentTask}` : 'Nenhuma tarefa ativa'}`);
    }
  } catch (error) {
    log(`Erro ao carregar estado: ${error.message}`);
  }
}

function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(processorState, null, 2));
  } catch (error) {
    log(`Erro ao salvar estado: ${error.message}`);
  }
}

// ========== BUSCAR IDs DINAMICAMENTE ==========
async function fetchUserIds() {
  try {
    log('🔍 Buscando IDs dos usuários...');
    
    // Buscar Alexandre pelo nickname
    const alexandreRes = await axios.get(`${API_URL}/api/users`);
    const allUsers = alexandreRes.data.users || [];
    
    const alexandre = allUsers.find(u => u.nickname === 'alexandre');
    const jarbas = allUsers.find(u => u.nickname === 'Jarbas');
    
    if (!alexandre) {
      throw new Error('Usuário Alexandre (nickname: "alexandre") não encontrado na API');
    }
    
    if (!jarbas) {
      throw new Error('Usuário Jarbas (nickname: "Jarbas") não encontrado na API');
    }
    
    MY_USER_ID = jarbas.id;
    ALEXANDRE_USER_ID = alexandre.id;
    
    log(`✅ IDs carregados: Alexandre=${ALEXANDRE_USER_ID.substring(0, 8)}..., Jarbas=${MY_USER_ID.substring(0, 8)}...`);
    return true;
    
  } catch (error) {
    log(`❌ Erro ao buscar IDs dos usuários: ${error.message}`);
    throw error;
  }
}

// ========== BUSCAR STATUS VISÍVEIS PARA IA ==========
async function getAIVisibleStatuses() {
  try {
    log('🔍 Buscando status visíveis para IA...');
    const response = await axios.get(`${API_URL}/api/statuses`);
    const statuses = response.data.statuses || [];
    
    // Filtrar status com visible_to_ai = true
    const aiVisibleStatuses = statuses
      .filter(status => status.visible_to_ai === true)
      .map(status => status.id);
    
    if (aiVisibleStatuses.length === 0) {
      throw new Error('Nenhum status visível para IA encontrado na API. O task-processor não funcionará.');
    }
    
    log(`✅ Status visíveis para IA encontrados: ${aiVisibleStatuses.length}`);
    return aiVisibleStatuses;
    
  } catch (error) {
    log(`❌ ERRO CRÍTICO ao buscar status: ${error.message}`);
    throw error; // Não há fallback - erro crítico
  }
}

// ========== VERIFICAÇÃO DE TAREFA ATIVA ==========
async function checkActiveTask() {
  try {
    // Primeiro buscar status "Em Andamento (IA)"
    const statuses = await getAIVisibleStatuses();
    
    // Buscar tarefas atribuídas ao Jarbas com qualquer status visível para IA
    const response = await axios.get(`${API_URL}/api/tasks?assignedToId=${MY_USER_ID}`);
    const allTasks = response.data.tasks || [];
    
    // Filtrar tarefas com status visível para IA
    const aiTasks = allTasks.filter(t => statuses.includes(t.statusId));
    
    if (aiTasks.length > 0) {
      const activeTask = aiTasks[0]; // Pegar a primeira tarefa ativa
      log(`Tarefa ativa encontrada: ${activeTask.title} (ID: ${activeTask.id})`);
      return activeTask;
    }
    
    return null;
  } catch (error) {
    log(`Erro ao verificar tarefa ativa: ${error.message}`);
    return null;
  }
}

// ========== VERIFICAÇÃO DE AGENTE ATIVO ==========
async function checkActiveAgent() {
  try {
    // Usar a API do OpenClaw para verificar sessões ativas
    const { exec: openclawExec } = require('child_process');
    const { promisify } = require('util');
    const exec = promisify(openclawExec);
    
    const result = await exec('openclaw sessions list --json');
    const sessions = JSON.parse(result.stdout);
    
    // Procurar sessão relacionada à tarefa atual
    if (processorState.currentTask && sessions && sessions.length > 0) {
      const taskIdShort = processorState.currentTask.substring(0, 8);
      const activeSession = sessions.find(session => {
        if (!session || !session.label) return false;
        return session.label.includes(taskIdShort) || 
               session.label.includes(processorState.currentTask);
      });
      
      if (activeSession) {
        log(`Sessão ativa encontrada: ${activeSession.id} (${activeSession.label})`);
        return {
          active: true,
          sessionId: activeSession.id,
          startedAt: activeSession.createdAt || processorState.taskStartedAt
        };
      }
    }
    
    return { active: false };
  } catch (error) {
    log(`Erro ao verificar sessões: ${error.message}`);
    return { active: false };
  }
}

// ========== CRIAÇÃO DE BRANCHES ==========
async function createBranchesForTask(task, project) {
  const branches = [];
  
  try {
    // Formatar nome da branch
    const branchName = `task/${task.id.substring(0, 8)}-${task.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .substring(0, 30)}`;
    
    // Criar branch no frontend (se configurado)
    if (project.frontendPath && fs.existsSync(project.frontendPath)) {
      const frontendRepo = project.frontendPath;
      
      try {
        // Verificar se é repositório git
        await exec(`cd "${frontendRepo}" && git status`);
        
        // Criar branch
        await exec(`cd "${frontendRepo}" && git checkout -b "${branchName}"`);
        log(`✅ Branch criada no frontend: ${branchName} em ${frontendRepo}`);
        
        branches.push({
          type: 'frontend',
          path: frontendRepo,
          branch: branchName
        });
      } catch (error) {
        log(`❌ Erro ao criar branch no frontend: ${error.message}`);
      }
    }
    
    // Criar branch no backend (se configurado)
    if (project.backendPath && fs.existsSync(project.backendPath)) {
      const backendRepo = project.backendPath;
      
      try {
        // Verificar se é repositório git
        await exec(`cd "${backendRepo}" && git status`);
        
        // Criar branch
        await exec(`cd "${backendRepo}" && git checkout -b "${branchName}"`);
        log(`✅ Branch criada no backend: ${branchName} em ${backendRepo}`);
        
        branches.push({
          type: 'backend',
          path: backendRepo,
          branch: branchName
        });
      } catch (error) {
        log(`❌ Erro ao criar branch no backend: ${error.message}`);
      }
    }
    
    return branches;
  } catch (error) {
    log(`Erro ao criar branches: ${error.message}`);
    return branches;
  }
}

// ========== DETECÇÃO DE ARQUIVOS MODIFICADOS ==========
async function getModifiedFiles(branches) {
  const modifiedFiles = [];
  
  for (const repo of branches) {
    try {
      const result = await exec(`cd "${repo.path}" && git status --porcelain`);
      const files = result.stdout
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          const status = line.substring(0, 2).trim();
          const filename = line.substring(3);
          return { repo: repo.type, status, filename, path: repo.path };
        });
      
      modifiedFiles.push(...files);
    } catch (error) {
      log(`Erro ao verificar arquivos modificados em ${repo.path}: ${error.message}`);
    }
  }
  
  return modifiedFiles;
}

// ========== COMMIT E PUSH AUTOMÁTICO ==========
async function commitAndPushChanges(branches, taskTitle) {
  for (const repo of branches) {
    try {
      // Adicionar todos os arquivos
      await exec(`cd "${repo.path}" && git add .`);
      
      // Fazer commit
      await exec(`cd "${repo.path}" && git commit -m "${taskTitle}"`);
      
      // Fazer push
      await exec(`cd "${repo.path}" && git push origin "${repo.branch}"`);
      
      log(`✅ Commit e push realizados em ${repo.type}: ${repo.branch}`);
    } catch (error) {
      log(`❌ Erro ao fazer commit/push em ${repo.type}: ${error.message}`);
    }
  }
}

// ========== PROCESSAMENTO DE TAREFA CONCLUÍDA ==========
async function processCompletedTask(taskId) {
  try {
    // Buscar detalhes da tarefa
    const taskRes = await axios.get(`${API_URL}/api/tasks/${taskId}`);
    const task = taskRes.data.task;
    
    // Buscar detalhes do projeto
    const projectRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
    const project = projectRes.data;
    
    // Verificar se há branches criadas para esta tarefa
    const taskBranches = processorState.branchesCreated.filter(b => 
      b.taskId === taskId
    );
    
    if (taskBranches.length > 0) {
      // Detectar arquivos modificados
      const modifiedFiles = await getModifiedFiles(taskBranches);
      
      if (modifiedFiles.length > 0) {
        // Fazer commit e push
        await commitAndPushChanges(taskBranches, task.title);
        
        // Criar comentário com lista de arquivos modificados
        const filesList = modifiedFiles.map(f => 
          `- ${f.repo}: ${f.filename} (${f.status})`
        ).join('\n');
        
        const commentContent = `📁 **Arquivos modificados nesta tarefa:**\n\n${filesList}\n\n✅ _Commit realizado na branch correspondente._`;
        
        await axios.post(`${API_URL}/api/comments`, {
          taskId: taskId,
          userId: MY_USER_ID,
          content: commentContent
        });
        
        log(`✅ Comentário com arquivos modificados adicionado à tarefa ${taskId}`);
      }
    }
    
    // Limpar estado da tarefa
    processorState.branchesCreated = processorState.branchesCreated.filter(b => 
      b.taskId !== taskId
    );
    
    if (processorState.currentTask === taskId) {
      processorState.currentTask = null;
      processorState.agentSessionId = null;
      processorState.taskStartedAt = null;
    }
    
    saveState();
    
  } catch (error) {
    log(`Erro ao processar tarefa concluída: ${error.message}`);
  }
}

// ========== VERIFICAÇÃO DE TIMEOUT (30 MINUTOS) ==========
async function checkTimeout() {
  if (!processorState.taskStartedAt) return false;
  
  const startedAt = new Date(processorState.taskStartedAt);
  const now = new Date();
  const minutesElapsed = (now - startedAt) / (1000 * 60);
  
  if (minutesElapsed > 30) {
    log(`⚠️ Timeout detectado: Tarefa ${processorState.currentTask} está ativa há ${Math.round(minutesElapsed)} minutos`);
    return true;
  }
  
  return false;
}

// ========== LIDAR COM TIMEOUT ==========
async function handleTimeout() {
  if (!processorState.currentTask) return;
  
  try {
    // Matar sessão ativa (se existir)
    const agentStatus = await checkActiveAgent();
    if (agentStatus.active) {
      try {
        const { exec: openclawExec } = require('child_process');
        const { promisify } = require('util');
        const exec = promisify(openclawExec);
        
        await exec(`openclaw sessions kill ${agentStatus.sessionId}`);
        log(`🔴 Sessão ${agentStatus.sessionId} finalizada por timeout`);
      } catch (error) {
        log(`Erro ao matar sessão: ${error.message}`);
      }
    }
    
    // Reatribuir tarefa para Alexandre
    await axios.put(`${API_URL}/api/tasks/${processorState.currentTask}`, {
      assignedToId: ALEXANDRE_USER_ID
      // Não alterar status - manter como está
    });
    
    // Adicionar comentário explicativo
    await axios.post(`${API_URL}/api/comments`, {
      taskId: processorState.currentTask,
      userId: MY_USER_ID,
      content: `⚠️ **Timeout detectado**\n\nO agente ficou travado por mais de 30 minutos. A tarefa foi reatribuída para @Alexandre para análise manual.\n\n_Timestamp: ${new Date().toLocaleString('pt-BR')}_`
    });
    
    log(`✅ Tarefa ${processorState.currentTask} reatribuída para Alexandre devido a timeout`);
    
    // Limpar estado
    processorState.currentTask = null;
    processorState.agentSessionId = null;
    processorState.taskStartedAt = null;
    saveState();
    
  } catch (error) {
    log(`Erro ao lidar com timeout: ${error.message}`);
  }
}

// ========== PROCESSAR PRÓXIMA TAREFA ==========
async function processNextTask() {
  try {
    log('=== PROCESSOR: Iniciando ciclo ===');
    
    // 1. Buscar IDs dos usuários (se necessário)
    if (!MY_USER_ID || !ALEXANDRE_USER_ID) {
      await fetchUserIds();
    }
    
    // 2. Verificar se há tarefa ativa
    const activeTask = await checkActiveTask();
    
    if (activeTask && activeTask.id) {
      // Atualizar estado se necessário
      if (processorState.currentTask !== activeTask.id) {
        processorState.currentTask = activeTask.id;
        processorState.taskStartedAt = new Date().toISOString();
        saveState();
      }
      
      // 3. Verificar se há agente ativo
      const agentStatus = await checkActiveAgent();
      
      if (agentStatus.active) {
        // 4. Verificar timeout
        if (await checkTimeout()) {
          await handleTimeout();
          return;
        }
        
        log(`⏳ Aguardando conclusão da tarefa ${activeTask.id} (agente ativo)`);
        return; // Não processar nova tarefa enquanto há agente ativo
      } else {
        // Agente não está ativo, mas tarefa está com status visível para IA
        // Verificar se a tarefa foi concluída
        try {
          const taskRes = await axios.get(`${API_URL}/api/tasks/${activeTask.id}`);
          const task = taskRes.data.task;
          
          // Buscar status "Concluído" para verificar
          const statusesRes = await axios.get(`${API_URL}/api/statuses`);
          const allStatuses = statusesRes.data.statuses || [];
          const completedStatus = allStatuses.find(s => s.name === 'Concluído');
          
          if (completedStatus && task && task.statusId === completedStatus.id) {
            log(`✅ Tarefa ${activeTask.id} concluída, processando...`);
            await processCompletedTask(activeTask.id);
            processorState.currentTask = null;
            processorState.taskStartedAt = null;
            saveState();
          } else {
            // Tarefa não concluída e sem agente ativo - pode ser um problema
            log(`⚠️ Tarefa ${activeTask.id} está com status visível para IA mas não há agente ativo`);
            
            // Verificar se passou muito tempo
            if (await checkTimeout()) {
              await handleTimeout();
              return;
            }
          }
        } catch (error) {
          log(`❌ Erro ao verificar tarefa ${activeTask.id}: ${error.message}`);
        }
      }
    } else {
      // Nenhuma tarefa ativa, limpar estado
      if (processorState.currentTask) {
        processorState.currentTask = null;
        processorState.agentSessionId = null;
        processorState.taskStartedAt = null;
        saveState();
      }
    }
    
    // 5. Buscar status visíveis para IA dinamicamente
    const aiVisibleStatuses = await getAIVisibleStatuses();
    
    // 6. Buscar tarefas não concluídas
    const tasksRes = await axios.get(`${API_URL}/api/tasks?isCompleted=false`);
    const allTasks = tasksRes.data.tasks || [];
    
    // 7. Filtrar tarefas com status visíveis para IA
    const aiTasks = allTasks.filter(t => aiVisibleStatuses.includes(t.statusId));
    
    // 8. Filtrar tarefas atribuídas ao Jarbas
    const myTasks = aiTasks.filter(t => t.assignedToId === MY_USER_ID);
    
    if (myTasks.length === 0) {
      log('Nenhuma tarefa elegível para IA atribuída ao Jarbas');
      return;
    }
    
    // 9. Ordenar por prioridade (posição) e pegar a primeira
    const task = myTasks.sort((a, b) => a.position - b.position)[0];
    
    log(`Tarefa selecionada: ${task.title} (ID: ${task.id})`);
    
    // 10. Buscar detalhes do projeto
    let projetoRegras = "Nenhuma regra específica definida.";
    let project = null;
    try {
      const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
      log(`API Projeto: Status ${projRes.status}`);
      
      project = projRes.data;
      projetoRegras = project.regras || projetoRegras;
      
      // Log detalhado para debug
      log(`Campos disponíveis no projeto: ${Object.keys(project).join(', ')}`);
      log(`Regras do projeto: ${projetoRegras}`);
      log(`Regras do projeto encontradas: ${projetoRegras !== "Nenhuma regra específica definida." ? "SIM" : "NÃO"}`);
    } catch (e) {
      log(`ERRO ao buscar projeto: ${e.message}`);
    }
    
    // 11. Buscar comentários
    let comentariosTexto = "Nenhum comentário até o momento.";
    try {
      const commRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
      log(`API Comentários: Status ${commRes.status}, Count: ${commRes.data.count || 0}`);
      const comments = commRes.data.comments || [];
      if (comments.length > 0) {
        comentariosTexto = comments
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(c => {
            const data = new Date(c.createdAt).toLocaleString('pt-BR');
            return `[${data}] ${(c.user && c.user.nickname) || 'Usuário'}: ${c.content}`;
          })
          .join('\n');
        log(`Comentários encontrados: ${comments.length}`);
      }
    } catch (e) {
      log(`ERRO ao buscar comentários: ${e.message}`);
    }
    
    // 12. Criar branches nos repositórios do projeto
    let branches = [];
    if (project) {
      branches = await createBranchesForTask(task, project);
      processorState.branchesCreated.push(...branches.map(b => ({
        taskId: task.id,
        ...b
      })));
      saveState();
    }
    
    // 13. Buscar status "Em Andamento (IA)" para atualizar
    let inProgressIAStatusId = null;
    try {
      const statusesRes = await axios.get(`${API_URL}/api/statuses`);
      const allStatuses = statusesRes.data.statuses || [];
      const inProgressIA = allStatuses.find(s => s.name === 'Em Andamento');
      
      if (inProgressIA) {
        inProgressIAStatusId = inProgressIA.id;
        
        // Atualizar status da tarefa
        await axios.put(`${API_URL}/api/tasks/${task.id}`, {
          statusId: inProgressIAStatusId
        });
        log(`✅ Status da tarefa atualizado para "Em Andamento"`);
      } else {
        log(`❌ Status "Em Andamento" não encontrado na API`);
      }
    } catch (error) {
      log(`❌ Erro ao atualizar status: ${error.message}`);
    }
    
    // 14. Preparar prompt para o agente
    const branchInfo = branches.length > 0 
      ? `\n\n📁 **BRANCHES CRIADAS:**\n${branches.map(b => `- ${b.type}: ${b.branch} (${b.path})`).join('\n')}\n\n⚠️ **TRABALHE NAS BRANCHES ACIMA!**`
      : '';
    
    const prompt = `=== TASK_DATA_START ===
TAREFA: ${task.title}
ID: ${task.id}
DESCRIÇÃO: ${task.description}

REGRAS DO PROJETO (OBRIGATÓRIAS):
${projetoRegras}
${branchInfo}

HISTÓRICO DE COMENTÁRIOS:
${comentariosTexto}

INSTRUÇÕES PARA O AGENTE:

1. ANALISE a tarefa acima com atenção
2. LEIA as regras do projeto - são OBRIGATÓRIAS
3. VERIFIQUE o histórico de comentários para contexto
4. EXECUTE a tarefa conforme solicitado${branches.length > 0 ? '\n5. TRABALHE EXCLUSIVAMENTE NAS BRANCHES CRIADAS ACIMA' : ''}

5. APÓS CONCLUIR, você DEVE finalizar a tarefa no sistema via API:
   - URL: ${API_URL}/api/tasks/${task.id}
   - Método: PUT
   - Corpo: {"statusId": "ID_DO_STATUS_CONCLUIDO"} (busque o ID do status "Concluído")
   - Em seguida, adicione um comentário com o relatório de execução via POST ${API_URL}/api/comments
   - Use o userId: ${MY_USER_ID} (Jarbas)

IMPORTANTE: Não altere o campo "isCompleted" - apenas Alexandre pode fazer isso.

=== TASK_DATA_END ===`;
    
    // 15. Chamar agente
    log(`📤 Chamando agente para tarefa: ${task.title}`);
    
    try {
      // Usar OpenClaw para spawnar sub-agente
      const { exec: openclawExec } = require('child_process');
      const { promisify } = require('util');
      const exec = promisify(openclawExec);
      
      const label = `task-${task.id.substring(0, 8)}-${task.title.substring(0, 20)}`;
      
      const result = await exec(`openclaw sessions spawn --task "${prompt.replace(/"/g, '\\"')}" --label "${label}" --agent-id main --mode run`);
      
      log(`✅ Agente spawnado: ${result.stdout.trim()}`);
      
      // Atualizar estado
      processorState.currentTask = task.id;
      processorState.taskStartedAt = new Date().toISOString();
      saveState();
      
    } catch (error) {
      log(`❌ Erro ao spawnar agente: ${error.message}`);
      
      // Não reverter status - manter como "Em Andamento" para análise manual
      log(`⚠️ Tarefa ${task.id} mantida como "Em Andamento" para análise manual devido a erro no agente`);
    }
    
  } catch (error) {
    log(`❌ Erro no processNextTask: ${error.message}`);
    console.error(error);
  }
}

// ========== FUNÇÃO PRINCIPAL ==========
async function main() {
  try {
    log('🚀 Iniciando Task Processor com configurações dinâmicas');
    
    // Carregar estado
    loadState();
    
    // Processar próxima tarefa
    await processNextTask();
    
    log('✅ Ciclo completo do Task Processor');
    
  } catch (error) {
    log(`❌ Erro fatal no Task Processor: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

// Executar
if (require.main === module) {
  main();
}

module.exports = {
  main,
  log,
  fetchUserIds,
  getAIVisibleStatuses,
  checkActiveTask,
  checkActiveAgent,
  createBranchesForTask,
  getModifiedFiles,
  commitAndPushChanges,
  processCompletedTask,
  checkTimeout,
  handleTimeout,
  processNextTask
};