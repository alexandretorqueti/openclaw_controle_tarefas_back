const axios = require('axios');

async function test() {
  try {
    // IDs from existing task
    const projectId = '2ca2eeed-1d03-4ecf-b054-92b2ca536a98';
    const statusId = '66b65e9c-88c5-49ce-994b-608281780ba6';
    const priorityId = '87b2babc-6c66-448b-b508-0e89491acad4';
    const createdById = '5fe303cc-19be-4d03-abe6-91a63414005f';
    const assignedToId = '5fe303cc-19be-4d03-abe6-91a63414005f';
    
    // Criar uma descrição com mais de 1000 caracteres
    const longDescription = 'A'.repeat(2000);
    
    const response = await axios.post('http://localhost:3001/api/tasks', {
      title: 'Tarefa teste descrição longa ' + Date.now(),
      description: longDescription,
      projectId,
      statusId,
      priorityId,
      createdById,
      assignedToId,
      deadline: new Date(Date.now() + 86400000).toISOString()
    });
    
    console.log('Sucesso! Tarefa criada:', response.data);
  } catch (error) {
    console.error('Erro:', error.response?.data || error.message);
  }
}

test();