const axios = require('axios');

async function test() {
  try {
    console.log('Testando API...');
    const res = await axios.get('http://localhost:3001/api/tasks?isCompleted=false');
    console.log('Total de tarefas:', res.data.tasks?.length || 0);
    
    // Filtrar tarefas com status específicos
    const aiStatuses = [
      '0df1e0ec-81d4-4579-846f-a7f5eff6fe9c', // Pendente
      '467c1869-3183-46cd-a728-83260efe3c78', // Em Andamento
      '28a4201d-272e-4e53-8c91-4cd5bf5ea516', // Em Andamento (IA)
      'd9bc0336-0a16-48eb-8fc7-0c5ebec06f97'  // Concluído
    ];
    
    const aiTasks = (res.data.tasks || []).filter(t => aiStatuses.includes(t.statusId));
    console.log('Tarefas elegíveis para IA:', aiTasks.length);
    
    if (aiTasks.length > 0) {
      const task = aiTasks[0];
      console.log('=== TASK_DATA_START ===');
      console.log(JSON.stringify({
        taskId: task.id,
        title: task.title,
        prompt: `Tarefa: ${task.title}\nDescrição: ${task.description}`,
        projectId: task.projectId,
        projectName: task.project?.name || 'N/A'
      }));
      console.log('=== TASK_DATA_END ===');
    } else {
      console.log('Nenhuma tarefa elegível para IA');
    }
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

test();