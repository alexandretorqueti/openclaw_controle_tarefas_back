#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { exec: execCmd } = require('child_process');
const { promisify } = require('util');
const exec = promisify(execCmd);

// Configurações
const API_URL = 'http://localhost:3001';
const MY_USER_ID = '6bdbe73b-8178-4fd5-987d-50f3b73beb2b'; // ID do Jarbas
const ALEXANDRE_USER_ID = 'dbd7aca0-ba0e-492b-9698-873c85979372'; // ID do Alexandre
const LOG_FILE = path.join(__dirname, 'task-processor.log');
const STATE_FILE = path.join(__dirname, 'task-processor-state.json');

const STATUS = {
  PENDING: '0df1e0ec-81d4-4579-846f-a7f5eff6fe9c',
  IN_PROGRESS: '467c1869-3183-46cd-a728-83260efe3c78',
  IN_PROGRESS_IA: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'
};

// Estado do processador
let processorState = {
  currentTask: null,
  agentSessionId: null,
  taskStartedAt: null,
  branchesCreated: [],
  lastCheck: null
};

// Carregar estado salvo
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

// Salvar estado
function saveState() {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(processorState, null, 2));
  } catch (error) {
    log(`Erro ao salvar estado: ${error.message}`);
  }
}

// Função para buscar status visíveis para IA dinamicamente
async function getAIVisibleStatuses() {
  try {
    const response = await axios.get(`${API_URL}/api/statuses`);
    const statuses = response.data.statuses || [];
    
    // Filtrar status com visible_to_ai = true
    const aiVisibleStatuses = statuses
      .filter(status => status.visible_to_ai === true)
      .map(status => status.id);
    
    await log(`Status visíveis para IA encontrados: ${aiVisibleStatuses.length}`);
    
    return aiVisibleStatuses;
  } catch (error) {
    await log(`Erro ao buscar status: ${error.message}`);
    // Fallback para lista hardcoded se a API falhar
    return [
      STATUS.PENDING,
      STATUS.IN_PROGRESS,
      STATUS.IN_PROGRESS_IA
    ];
  }
}

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
    
    // Manter apenas as últimas 100 linhas
    if (logs.length > 100) {
      logs = logs.slice(0, 100);
    }
    
    // Salvar log
    fs.writeFileSync(LOG_FILE, logs.join('\n') + '\n');
  } catch (error) {
    console.error(`Erro ao escrever log: ${error.message}`);
  }
}

// Verificar se há tarefa "Em Andamento" atribuída ao Jarbas
async function checkActiveTask() {
  try {
    // Buscar tarefas atribuídas ao Jarbas com status "Em Andamento (IA)"
    const response = await axios.get(`${API_URL}/api/tasks?assignedToId=${MY_USER_ID}&statusId=${STATUS.IN_PROGRESS_IA}`);
    const tasks = response.data.tasks || [];
    
    if (tasks.length > 0) {
      const activeTask = tasks[0]; // Pegar a primeira tarefa ativa
      await log(`Tarefa ativa encontrada: ${activeTask.title} (ID: ${activeTask.id})`);
      return activeTask;
    }
    
    return null;
  } catch (error) {
    await log(`Erro ao verificar tarefa ativa: ${error.message}`);
    return null;
  }
}

// Verificar se há sub-agente ativo para a tarefa
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
        await log(`Sessão ativa encontrada: ${activeSession.id} (${activeSession.label})`);
        return {
          active: true,
          sessionId: activeSession.id,
          startedAt: activeSession.createdAt || processorState.taskStartedAt
        };
      }
    }
    
    return { active: false };
  } catch (error) {
    await log(`Erro ao verificar sessões: ${error.message}`);
    return { active: false };
  }
}

// Criar branch nos repositórios do projeto
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
        await log(`✅ Branch criada no frontend: ${branchName} em ${frontendRepo}`);
        
        branches.push({
          type: 'frontend',
          path: frontendRepo,
          branch: branchName
        });
      } catch (error) {
        await log(`❌ Erro ao criar branch no frontend: ${error.message}`);
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
        await log(`✅ Branch criada no backend: ${branchName} em ${backendRepo}`);
        
        branches.push({
          type: 'backend',
          path: backendRepo,
          branch: branchName
        });
      } catch (error) {
        await log(`❌ Erro ao criar branch no backend: ${error.message}`);
      }
    }
    
    return branches;
  } catch (error) {
    await log(`Erro ao criar branches: ${error.message}`);
    return branches;
  }
}

// Detectar arquivos modificados nos repositórios
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
      await log(`Erro ao verificar arquivos modificados em ${repo.path}: ${error.message}`);
    }
  }
  
  return modifiedFiles;
}

// Fazer commit e push das alterações
async function commitAndPushChanges(branches, taskTitle) {
  for (const repo of branches) {
    try {
      // Adicionar todos os arquivos
      await exec(`cd "${repo.path}" && git add .`);
      
      // Fazer commit
      await exec(`cd "${repo.path}" && git commit -m "${taskTitle}"`);
      
      // Fazer push
      await exec(`cd "${repo.path}" && git push origin "${repo.branch}"`);
      
      await log(`✅ Commit e push realizados em ${repo.type}: ${repo.branch}`);
    } catch (error) {
      await log(`❌ Erro ao fazer commit/push em ${repo.type}: ${error.message}`);
    }
  }
}

// Processar tarefa concluída
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
        
        await log(`✅ Comentário com arquivos modificados adicionado à tarefa ${taskId}`);
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
    await log(`Erro ao processar tarefa concluída: ${error.message}`);
  }
}

// Verificar timeout (3 horas) - pode ser ajustado conforme necessário
async function checkTimeout() {
  if (!processorState.taskStartedAt) return false;
  
  const startedAt = new Date(processorState.taskStartedAt);
  const now = new Date();
  const minutesElapsed = (now - startedAt) / (1000 * 60);
  
  if (minutesElapsed > 180) { // 180 minutos = 3 horas
    await log(`⚠️ Timeout detectado: Tarefa ${processorState.currentTask} está ativa há ${Math.round(minutesElapsed)} minutos`);
    return true;
  }
  
  return false;
}

// Lidar com timeout
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
        await log(`🔴 Sessão ${agentStatus.sessionId} finalizada por timeout`);
      } catch (error) {
        await log(`Erro ao matar sessão: ${error.message}`);
      }
    }
    
    // Reatribuir tarefa para Alexandre
    await axios.put(`${API_URL}/api/tasks/${processorState.currentTask}`, {
      assignedToId: ALEXANDRE_USER_ID,
      statusId: STATUS.IN_PROGRESS
    });
    
    // Adicionar comentário explicativo
    await axios.post(`${API_URL}/api/comments`, {
      taskId: processorState.currentTask,
      userId: MY_USER_ID,
      content: `⚠️ **Timeout detectado**\n\nO agente ficou travado por mais de 30 minutos. A tarefa foi reatribuída para @Alexandre para análise manual.\n\n_Timestamp: ${new Date().toLocaleString('pt-BR')}_`
    });
    
    await log(`✅ Tarefa ${processorState.currentTask} reatribuída para Alexandre devido a timeout`);
    
    // Limpar estado
    processorState.currentTask = null;
    processorState.agentSessionId = null;
    processorState.taskStartedAt = null;
    saveState();
    
  } catch (error) {
    await log(`Erro ao lidar com timeout: ${error.message}`);
  }
}

// Processar próxima tarefa elegível
async function processNextTask() {
  try {
    await log('=== PROCESSOR: Iniciando ciclo ===');
    
    // 1. Verificar se há tarefa ativa
    const activeTask = await checkActiveTask();
    
    if (activeTask && activeTask.id) {
      // Atualizar estado se necessário
      if (processorState.currentTask !== activeTask.id) {
        processorState.currentTask = activeTask.id;
        processorState.taskStartedAt = new Date().toISOString();
        saveState();
      }
      
      // 2. Verificar se há agente ativo
      const agentStatus = await checkActiveAgent();
      
      if (agentStatus.active) {
        // 3. Verificar timeout
        if (await checkTimeout()) {
          await handleTimeout();
          return;
        }
        
        await log(`⏳ Aguardando conclusão da tarefa ${activeTask.id} (agente ativo)`);
        return; // Não processar nova tarefa enquanto há agente ativo
      } else {
        // Agente não está ativo, mas tarefa está "Em Andamento"
        // Verificar se a tarefa foi concluída
        try {
          const taskRes = await axios.get(`${API_URL}/api/tasks/${activeTask.id}`);
          const task = taskRes.data.task;
          
          if (task && task.statusId === STATUS.COMPLETED) {
            await log(`✅ Tarefa ${activeTask.id} concluída, processando...`);
            await processCompletedTask(activeTask.id);
            processorState.currentTask = null;
            processorState.taskStartedAt = null;
            saveState();
          } else {
            // Tarefa não concluída e sem agente ativo - pode ser um problema
            await log(`⚠️ Tarefa ${activeTask.id} está "Em Andamento" mas não há agente ativo`);
            
            // Verificar se passou muito tempo
            if (await checkTimeout()) {
              await handleTimeout();
              return;
            }
          }
        } catch (error) {
          await log(`❌ Erro ao verificar tarefa ${activeTask.id}: ${error.message}`);
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
    
    // 4. Buscar status visíveis para IA dinamicamente
    const aiVisibleStatuses = await getAIVisibleStatuses();
    
    // 5. Buscar tarefas não concluídas
    const tasksRes = await axios.get(`${API_URL}/api/tasks?isCompleted=false`);
    const allTasks = tasksRes.data.tasks || [];
    
    // 6. Filtrar tarefas com status visíveis para IA
    const aiTasks = allTasks.filter(t => aiVisibleStatuses.includes(t.statusId));
    
    // 7. Filtrar tarefas atribuídas ao Jarbas
    const myTasks = aiTasks.filter(t => t.assignedToId === MY_USER_ID);
    
    if (myTasks.length === 0) {
      await log('Nenhuma tarefa elegível para IA atribuída ao Jarbas');
      return;
    }
    
    // 8. Ordenar por prioridade (posição) e pegar a primeira
    const task = myTasks.sort((a, b) => a.position - b.position)[0];
    
    await log(`Tarefa selecionada: ${task.title} (ID: ${task.id})`);
    
    // 9. Buscar detalhes do projeto
    let projetoRegras = "Nenhuma regra específica definida.";
    let project = null;
    try {
      const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
      await log(`API Projeto: Status ${projRes.status}`);
      
      project = projRes.data;
      projetoRegras = project.regras || projetoRegras;
      
      // Log detalhado para debug
      await log(`Campos disponíveis no projeto: ${Object.keys(project).join(', ')}`);
      await log(`Regras do projeto: ${projetoRegras}`);
      await log(`Regras do projeto encontradas: ${projetoRegras !== "Nenhuma regra específica definida." ? "SIM" : "NÃO"}`);
    } catch (e) {
      await log(`ERRO ao buscar projeto: ${e.message}`);
    }
    
    // 10. Buscar comentários
    let comentariosTexto = "Nenhum comentário até o momento.";
    try {
      const commRes = await axios.get(`${API_URL}/api/comments/task/${task.id}`);
      await log(`API Comentários: Status ${commRes.status}, Count: ${commRes.data.count || 0}`);
      const comments = commRes.data.comments || [];
      if (comments.length > 0) {
        comentariosTexto = comments
          .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
          .map(c => {
            const data = new Date(c.createdAt).toLocaleString('pt-BR');
            return `[${data}] ${(c.user && c.user.nickname) || 'Usuário'}: ${c.content}`;
          })
          .join('\n');
        await log(`Comentários encontrados: ${comments.length}`);
      }
    } catch (e) {
      await log(`ERRO ao buscar comentários: ${e.message}`);
    }
    
    // 11. Criar branches nos repositórios do projeto
    let branches = [];
    if (project) {
      branches = await createBranchesForTask(task, project);
      processorState.branchesCreated.push(...branches.map(b => ({
        taskId: task.id,
        ...b
      })));
      saveState();
    }
    
    // 12. Atualizar status da tarefa para "Em Andamento (IA)"
    try {
      await axios.put(`${API_URL}/api/tasks/${task.id}`, {
        statusId: STATUS.IN_PROGRESS_IA
      });
      await log(`✅ Status da tarefa atualizado para "Em Andamento (IA)"`);
    } catch (error) {
      await log(`❌ Erro ao atualizar status: ${error.message}`);
    }
    
    // 13. Preparar prompt para o agente
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
   - URL: http://localhost:3001/api/tasks/${task.id}
   - Método: PUT
   - Corpo: {"statusId": "${STATUS.COMPLETED}"}
   - Em seguida, adicione um comentário com o relatório de execução via POST /api/comments
   - Use o userId: ${MY_USER_ID} (Jarbas)

IMPORTANTE: Não altere o campo "isCompleted" - apenas Alexandre pode fazer isso.

=== TASK_DATA_END ===`;
    
    // 14. Chamar agente
    await log(`📤 Chamando agente para tarefa: ${task.title}`);
    
    try {
      // Usar OpenClaw para spawnar sub-agente
      const { exec: openclawExec } = require('child_process');
      const { promisify } = require('util');
      const exec = promisify(openclawExec);
      
      const label = `task-${task.id.substring(0, 8)}-${task.title.substring(0, 20)}`;
      
      const result = await exec(`openclaw sessions spawn --task "${prompt.replace(/"/g, '\\"')}" --label "${label}" --agent-id main --mode run`);
      
      await log(`✅ Agente spawnado: ${result.stdout.trim()}`);
      
      // Atualizar estado
      processorState.currentTask = task.id;
      processorState.taskStartedAt = new Date().toISOString();
      saveState();
      
    } catch (error) {
      await log(`❌ Erro ao spawnar agente: ${error.message}`);
      
      // Reverter status se falhar
      try {
        await axios.put(`${API_URL}/api/tasks/${task.id}`, {
          statusId: STATUS.PENDING
        });
        await log(`✅ Status revertido para "Pendente" devido a erro no agente`);
      } catch (revertError) {
        await log(`❌ Erro ao reverter status: ${revertError.message}`);
      }
    }
    
  } catch (error) {
    await log(`❌ Erro no processNextTask: ${error.message}`);
    console.error(error);
  }
}

// Função principal
async function main() {
  try {
    await log('🚀 Iniciando Task Processor com monitoramento avançado');
    
    // Carregar estado
    loadState();
    
    // Processar próxima tarefa
    await processNextTask();
    
    await log('✅ Ciclo completo do Task Processor');
    
  } catch (error) {
    await log(`❌ Erro fatal no Task Processor: ${error.message}`);
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