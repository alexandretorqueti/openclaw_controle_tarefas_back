// Teste unitário para endpoint de prioridade de tarefas
// Objetivo: Testar se o endpoint /api/tasks/next/:nickname retorna tarefas na ordem correta de prioridade

const axios = require('axios');
const API_URL = 'http://localhost:3001';

// IDs das tarefas criadas para limpeza
let createdTaskIds = [];

// Cache de dados do sistema
let systemData = {
  priorities: [],
  statuses: [],
  userId: null
};

// Função para buscar dados do sistema
async function fetchSystemData() {
  try {
    console.log('🔍 Buscando dados do sistema...');
    
    // Buscar prioridades
    const prioritiesResponse = await axios.get(`${API_URL}/api/priorities`);
    systemData.priorities = prioritiesResponse.data.priorities || [];
    console.log(`✅ ${systemData.priorities.length} prioridades encontradas`);
    
    // Buscar statuses
    const statusesResponse = await axios.get(`${API_URL}/api/statuses`);
    systemData.statuses = statusesResponse.data.statuses || [];
    console.log(`✅ ${systemData.statuses.length} statuses encontrados`);
    
    // Buscar usuário 'alexandre'
    try {
      const userResponse = await axios.get(`${API_URL}/api/users/nickname/alexandre`);
      systemData.userId = userResponse.data.user?.id;
      console.log(`✅ Usuário 'alexandre' encontrado (ID: ${systemData.userId})`);
    } catch (userError) {
      console.log('⚠️  Usuário "alexandre" não encontrado, usando ID padrão');
      systemData.userId = '5fe303cc-19be-4d03-abe6-91a63414005f'; // ID padrão do sistema
    }
    
    return systemData;
  } catch (error) {
    console.error('❌ Erro ao buscar dados do sistema:', error.response?.data || error.message);
    throw error;
  }
}

// Função para criar uma tarefa
async function createTask(taskData) {
  try {
    const response = await axios.post(`${API_URL}/api/tasks`, taskData);
    console.log(`✅ Tarefa criada: ${taskData.title} (ID: ${response.data.task.id})`);
    createdTaskIds.push(response.data.task.id);
    return response.data.task;
  } catch (error) {
    console.error(`❌ Erro ao criar tarefa ${taskData.title}:`, error.response?.data || error.message);
    throw error;
  }
}

// Função para buscar próxima tarefa
async function getNextTask(nickname) {
  try {
    const response = await axios.get(`${API_URL}/api/tasks/next/${nickname}`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao buscar próxima tarefa para ${nickname}:`, error.response?.data || error.message);
    throw error;
  }
}

// Função para marcar tarefa como concluída
async function completeTask(taskId) {
  try {
    const response = await axios.patch(`${API_URL}/api/tasks/${taskId}/finalize`, {
      userId: systemData.userId
    });
    console.log(`✅ Tarefa ${taskId} marcada como concluída`);
    return response.data;
  } catch (error) {
    console.error(`❌ Erro ao concluir tarefa ${taskId}:`, error.response?.data || error.message);
    throw error;
  }
}

// Função para excluir tarefa
async function deleteTask(taskId) {
  try {
    await axios.delete(`${API_URL}/api/tasks/${taskId}`);
    console.log(`✅ Tarefa ${taskId} excluída`);
  } catch (error) {
    console.error(`❌ Erro ao excluir tarefa ${taskId}:`, error.response?.data || error.message);
  }
}

// Função principal de teste
async function runPriorityTest() {
  console.log('🚀 INICIANDO TESTE DE PRIORIDADE DE TAREFAS\n');
  
  // 0. Buscar dados do sistema
  await fetchSystemData();
  
  if (systemData.priorities.length < 4) {
    console.log(`❌ Sistema precisa de pelo menos 4 prioridades, mas tem apenas ${systemData.priorities.length}`);
    console.log('Prioridades encontradas:', systemData.priorities.map(p => `${p.name} (peso: ${p.weight})`).join(', '));
    return;
  }
  
  if (systemData.statuses.length === 0) {
    console.log('❌ Nenhum status encontrado no sistema');
    return;
  }
  
  // Ordenar prioridades por peso (maior primeiro)
  const sortedPriorities = [...systemData.priorities].sort((a, b) => b.weight - a.weight);
  
  // Pegar as 4 prioridades com maiores pesos
  const testPriorities = sortedPriorities.slice(0, 4);
  
  // Encontrar status "To Do" ou primeiro status disponível
  const todoStatus = systemData.statuses.find(s => s.name.toLowerCase().includes('todo')) || systemData.statuses[0];
  
  console.log(`\n📊 Dados do teste:`);
  console.log(`- Prioridades usadas: ${testPriorities.map(p => `${p.name} (peso: ${p.weight})`).join(', ')}`);
  console.log(`- Status usado: ${todoStatus.name}`);
  console.log(`- Usuário ID: ${systemData.userId}\n`);
  
  // 1. Criar 4 tarefas com diferentes prioridades
  console.log('1. Criando 4 tarefas com diferentes prioridades...');
  
  // Usar o primeiro projeto disponível
  const projectId = '97e06a2e-8184-4c29-94b1-8c8768113f7c';
  
  const tasks = testPriorities.map((priority, index) => ({
    title: `Tarefa Teste ${index + 1} - ${priority.name} (peso ${priority.weight})`,
    description: `Tarefa de teste com prioridade ${priority.name} e peso ${priority.weight}`,
    priorityId: priority.id,
    assignedToId: systemData.userId,
    statusId: todoStatus.id,
    projectId: projectId,
    isRecurring: false,
    deadline: new Date(Date.now() + (index + 1) * 24 * 60 * 60 * 1000).toISOString() // Deadlines diferentes
  }));
  
  const createdTasks = [];
  for (const taskData of tasks) {
    try {
      const task = await createTask(taskData);
      createdTasks.push(task);
    } catch (error) {
      console.log(`⚠️  Pulando criação de ${taskData.title} - possivelmente IDs de prioridade/status incorretos`);
    }
  }
  
  if (createdTasks.length === 0) {
    console.log('❌ Nenhuma tarefa foi criada. Verifique os IDs de prioridade/status.');
    return;
  }
  
  console.log(`\n✅ ${createdTasks.length} tarefas criadas com sucesso!\n`);
  
  // 2. Testar o endpoint 4 vezes
  console.log('2. Testando endpoint /api/tasks/next/alexandre...');
  
  let testCount = 1;
  let previousTaskId = null;
  let priorityFailures = 0;
  
  // Criar uma cópia ordenada por prioridade (peso decrescente) para validação
  const expectedOrder = [...createdTasks].sort((a, b) => {
    const priorityA = testPriorities.find(p => p.id === a.priorityId)?.weight || 0;
    const priorityB = testPriorities.find(p => p.id === b.priorityId)?.weight || 0;
    return priorityB - priorityA; // Ordem decrescente (maior peso primeiro)
  });
  
  console.log('\n📋 Ordem esperada por prioridade:');
  expectedOrder.forEach((task, index) => {
    const priority = testPriorities.find(p => p.id === task.priorityId);
    console.log(`  ${index + 1}. ${task.title} - Peso: ${priority?.weight || 'N/A'}`);
  });
  console.log('');
  
  while (testCount <= 4 && createdTasks.length > 0) {
    console.log(`\n--- Teste ${testCount} ---`);
    
    // Buscar próxima tarefa
    const nextTaskResponse = await getNextTask('alexandre');
    
    if (!nextTaskResponse.task) {
      console.log('❌ Nenhuma tarefa retornada pelo endpoint');
      break;
    }
    
    console.log(`✅ Próxima tarefa: ${nextTaskResponse.task.title}`);
    console.log(`   ID: ${nextTaskResponse.task.id}`);
    console.log(`   Prioridade: ${nextTaskResponse.task.priority?.name || 'N/A'} (peso: ${nextTaskResponse.task.priority?.weight || 'N/A'})`);
    
    // VERIFICAÇÃO DE PRIORIDADE - CRÍTICO!
    const currentTaskIndex = expectedOrder.findIndex(t => t.id === nextTaskResponse.task.id);
    const expectedTaskIndex = testCount - 1; // Primeira chamada deve retornar a primeira da lista ordenada
    
    if (currentTaskIndex === -1) {
      console.log(`❌ ERRO: Tarefa retornada não está na lista de tarefas criadas!`);
    } else if (currentTaskIndex !== expectedTaskIndex) {
      console.log(`❌ FALHA DE PRIORIDADE: Tarefa retornada está na posição ${currentTaskIndex + 1}, mas deveria estar na posição ${expectedTaskIndex + 1}`);
      console.log(`   Esperado: ${expectedOrder[expectedTaskIndex]?.title || 'N/A'}`);
      console.log(`   Recebido: ${nextTaskResponse.task.title}`);
      console.log(`   Peso esperado: ${testPriorities.find(p => p.id === expectedOrder[expectedTaskIndex]?.priorityId)?.weight || 'N/A'}`);
      console.log(`   Peso recebido: ${nextTaskResponse.task.priority?.weight || 'N/A'}`);
      priorityFailures++;
    } else {
      console.log(`✅ PRIORIDADE CORRETA: Tarefa na posição ${expectedTaskIndex + 1} como esperado`);
      console.log(`   Peso da prioridade: ${nextTaskResponse.task.priority?.weight || 'N/A'}`);
    }
    
    // Verificar se é uma tarefa diferente da anterior
    if (nextTaskResponse.task.id === previousTaskId) {
      console.log('⚠️  ATENÇÃO: Mesma tarefa retornada novamente!');
    }
    
    // Marcar como concluída
    await completeTask(nextTaskResponse.task.id);
    
    // Remover da lista de tarefas criadas
    const taskIndex = createdTasks.findIndex(t => t.id === nextTaskResponse.task.id);
    if (taskIndex !== -1) {
      createdTasks.splice(taskIndex, 1);
    }
    
    previousTaskId = nextTaskResponse.task.id;
    testCount++;
  }
  
  // RESULTADO FINAL DO TESTE DE PRIORIDADE
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESULTADO FINAL DO TESTE DE PRIORIDADE');
  console.log('='.repeat(60));
  
  if (priorityFailures === 0) {
    console.log('✅✅✅ TESTE DE PRIORIDADE APROVADO!');
    console.log('Todas as tarefas foram retornadas na ordem correta de prioridade.');
  } else {
    console.log(`❌❌❌ TESTE DE PRIORIDADE FALHOU!`);
    console.log(`Foram encontradas ${priorityFailures} falha(s) de prioridade.`);
    console.log('O endpoint NÃO está retornando tarefas na ordem correta de prioridade.');
  }
  
  console.log('='.repeat(60) + '\n');
  
  console.log('✅ Teste de prioridade concluído!');
  
  // 3. Limpeza
  console.log('\n3. Limpando tarefas de teste...');
  for (const taskId of createdTaskIds) {
    await deleteTask(taskId);
  }
  
  console.log('\n🎉 TESTE FINALIZADO COM SUCESSO!');
}

// Executar teste
runPriorityTest().catch(error => {
  console.error('❌ ERRO NO TESTE:', error.message);
  console.error('Stack:', error.stack);
  
  // Tentar limpar mesmo em caso de erro
  console.log('\nTentando limpar tarefas criadas...');
  createdTaskIds.forEach(taskId => {
    deleteTask(taskId).catch(() => {});
  });
  
  process.exit(1);
});