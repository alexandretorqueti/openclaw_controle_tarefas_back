const axios = require('axios');

async function getIds() {
  try {
    const [projectsRes, statusesRes, prioritiesRes, usersRes] = await Promise.all([
      axios.get('http://localhost:3001/api/projects'),
      axios.get('http://localhost:3001/api/statuses'),
      axios.get('http://localhost:3001/api/priorities'),
      axios.get('http://localhost:3001/api/users')
    ]);
    
    return {
      projectId: projectsRes.data.projects[0]?.id,
      statusId: statusesRes.data.statuses[0]?.id,
      priorityId: prioritiesRes.data.priorities[0]?.id,
      userId: usersRes.data.users[0]?.id
    };
  } catch (error) {
    console.error('Erro ao buscar IDs:', error.response?.data || error.message);
    return null;
  }
}

async function testLongDescription() {
  const ids = await getIds();
  if (!ids) {
    console.log('Não foi possível obter IDs');
    return;
  }
  
  console.log('IDs obtidos:', ids);
  
  const longDescription = 'A'.repeat(2000);
  
  try {
    const response = await axios.post('http://localhost:3001/api/tasks', {
      title: 'Tarefa teste descrição longa',
      description: longDescription,
      projectId: ids.projectId,
      statusId: ids.statusId,
      priorityId: ids.priorityId,
      createdById: ids.userId,
      assignedToId: ids.userId,
      deadline: new Date(Date.now() + 86400000).toISOString()
    });
    
    console.log('✅ Sucesso! Tarefa criada com descrição de 2000 caracteres.');
    console.log('Resposta completa:', JSON.stringify(response.data, null, 2));
    const taskId = response.data.task?.id;
    console.log('ID da tarefa:', taskId);
    
    if (taskId) {
      // Verificar se a descrição foi salva completa
      const taskRes = await axios.get(`http://localhost:3001/api/tasks/${taskId}`);
      console.log('Comprimento da descrição salva:', taskRes.data.description?.length);
      
      // Limpar: deletar a tarefa de teste
      await axios.delete(`http://localhost:3001/api/tasks/${taskId}`);
      console.log('Tarefa de teste removida.');
    } else {
      console.log('Não foi possível obter o ID da tarefa da resposta.');
    }
  } catch (error) {
    console.error('❌ Erro ao criar tarefa:');
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    } else {
      console.error('Message:', error.message);
    }
  }
}

testLongDescription();