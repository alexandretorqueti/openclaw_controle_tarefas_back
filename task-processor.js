#!/usr/bin/env node

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configurações
const API_URL = 'http://localhost:3001';
const TASKS_DIR = path.join(__dirname, 'pending-tasks');
const MY_USER_ID = '6bdbe73b-8178-4fd5-987d-50f3b73beb2b'; // ID do Jarbas
const LOG_FILE = path.join(__dirname, 'task-processor.log');

const STATUS = {
  IN_PROGRESS: '28a4201d-272e-4e53-8c91-4cd5bf5ea516',
  COMPLETED: 'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'
};

// Teste de processador de tarefas - Tarefa ID eeda3ca8-7267-44ed-8f32-70c2fdd8af80
// Verificado em 2026-02-25: processador está funcionando corretamente.

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
      '0df1e0ec-81d4-4579-846f-a7f5eff6fe9c', // Pendente
      '467c1869-3183-46cd-a728-83260efe3c78', // Em Andamento
      '28a4201d-272e-4e53-8c91-4cd5bf5ea516', // Em Andamento (IA)
      'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'  // Concluído
    ];
  }
}

async function log(message) {
  const timestamp = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
  const logLine = `[${timestamp}] ${message}\n`;
  
  try {
    let currentLogs = '';
    if (fs.existsSync(LOG_FILE)) {
      currentLogs = fs.readFileSync(LOG_FILE, 'utf8');
    }
    
    // Novo log no topo
    let logsArray = currentLogs.split('\n').filter(line => line.trim() !== '');
    logsArray.unshift(logLine.trim());
    
    // Limitar a 100 linhas
    if (logsArray.length > 100) {
      logsArray = logsArray.slice(0, 100);
    }
    
    fs.writeFileSync(LOG_FILE, logsArray.join('\n') + '\n');
  } catch (err) {
    console.error('Erro ao gravar log:', err);
  }
}

async function processNextTask() {
  try {
    await log('=== PROCESSOR: Iniciando ciclo ===');
    
    // Buscar status visíveis para IA dinamicamente
    const aiVisibleStatuses = await getAIVisibleStatuses();
    
    // Buscar tarefas não concluídas
    const tasksRes = await axios.get(`${API_URL}/api/tasks?isCompleted=false`);
    const allTasks = tasksRes.data.tasks || [];
    
    // Filtrar tarefas com status visíveis para IA
    const aiTasks = allTasks.filter(t => aiVisibleStatuses.includes(t.statusId));
    
    if (aiTasks.length === 0) {
      await log('Nenhuma tarefa elegível para IA.');
      return;
    }
    
    const task = aiTasks[0];
    await log(`Processando tarefa: ${task.title} (${task.id})`);
    
    // Atualizar status para "Em Andamento"
    await axios.put(`${API_URL}/api/tasks/${task.id}`, { statusId: STATUS.IN_PROGRESS });
    
    // Buscar detalhes do projeto (regras)
    let projetoRegras = "Nenhuma regra específica definida.";
    try {
      const projRes = await axios.get(`${API_URL}/api/projects/${task.projectId}`);
      await log(`API Projeto: Status ${projRes.status}`);
      
      // A API retorna o projeto diretamente no data, não dentro de um objeto 'project'
      const projetoData = projRes.data;
      projetoRegras = projetoData.regras || projetoRegras;
      
      // Log detalhado para debug
      await log(`Campos disponíveis no projeto: ${Object.keys(projetoData).join(', ')}`);
      await log(`Regras do projeto: ${projetoRegras}`);
      await log(`Regras do projeto encontradas: ${projetoRegras !== "Nenhuma regra específica definida." ? "SIM" : "NÃO"}`);
    } catch (e) {
      await log(`ERRO ao buscar projeto: ${e.message}`);
    }
    
    // Buscar comentários
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
    
    // Criar prompt rico
    const prompt = `### CONTEXTO DA TAREFA ###
TÍTULO: ${task.title}
PROJETO: ${(task.project && task.project.name) || 'N/A'}
DESCRIÇÃO: ${task.description}

### REGRAS DO PROJETO (OBRIGATÓRIAS) ###
${projetoRegras}

### HISTÓRICO DE COMENTÁRIOS ###
${comentariosTexto}

### INSTRUÇÕES DE EXECUÇÃO ###
1. Você deve realizar as alterações no código baseando-se na descrição, nas regras do projeto e no histórico de conversa acima.
2. É OBRIGATÓRIO escrever um resumo técnico detalhado de TUDO o que foi alterado.
3. Se houver erro técnico, relate-o para análise.
4. Não encerre a sessão sem confirmar que as mudanças foram salvas no sistema de arquivos.
5. APÓS CONCLUIR, você DEVE finalizar a tarefa no sistema via API:
   - URL: http://localhost:3001/api/tasks/${task.id}
   - Método: PUT
   - Corpo: {"statusId": "d9bc0336-0a16-48eb-8fc7-0c5ebec06f97"}
   - Em seguida, adicione um comentário com o relatório de execução via POST /api/comments
   - Use o userId: 6bdbe73b-8178-4fd5-987d-50f3b73beb2b (Jarbas)

### DADOS DA TAREFA ###
TASK_ID: ${task.id}
PROJECT_ID: ${task.projectId}
API_URL: http://localhost:3001`;
    
    await log(`Prompt preparado (${prompt.length} caracteres).`);
    fs.writeFileSync(LOG_FILE, prompt + '\n\n' + fs.readFileSync(LOG_FILE, 'utf8'));
    
    // Retornar o prompt para o agente OpenClaw (que chamou este script)
    // O agente principal usará sessions_spawn com este prompt
    console.log('=== TASK_DATA_START ===');
    console.log(JSON.stringify({
      taskId: task.id,
      title: task.title,
      prompt: prompt,
      projectId: task.projectId,
      projectName: (task.project && task.project.name) || 'N/A'
    }));
    console.log('=== TASK_DATA_END ===');
    
  } catch (error) {
    await log(`ERRO: ${error.message}`);
    if (error.response) {
      await log(`Resposta: ${error.response.status} ${JSON.stringify(error.response.data)}`);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  processNextTask().catch(err => {
    console.error('Erro fatal:', err);
    process.exit(1);
  });
}