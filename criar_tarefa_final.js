const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function criarTarefaFinal() {
  try {
    // Buscar usuário jarbas
    const usuario = await prisma.user.findUnique({
      where: { nickname: 'jarbas' }
    });
    
    // Buscar status "Pendente"
    const statusPendente = await prisma.status.findFirst({
      where: { name: 'Pendente' }
    });
    
    // Buscar prioridade "Média"
    const prioridadeMedia = await prisma.priority.findFirst({
      where: { name: 'Média' }
    });
    
    // Buscar primeiro projeto
    const projeto = await prisma.project.findFirst();
    
    // Criar tarefa mínima
    const tarefa = await prisma.task.create({
      data: {
        title: 'TESTE MONITOR FLUXO COMPLETO',
        description: 'Tarefa para testar todas as etapas do monitor sequencialmente',
        projectId: projeto.id,
        createdById: usuario.id,
        assignedToId: usuario.id,
        statusId: statusPendente.id,
        priorityId: prioridadeMedia.id,
        domain: 'FRONTEND',
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
      }
    });
    
    console.log('✅ Tarefa criada:', tarefa.id);
    
    // Verificar via API
    const fetch = await import('node-fetch');
    const response = await fetch.default(`http://localhost:4001/api/tasks/next/jarbas`);
    const data = await response.json();
    
    console.log('Resposta da API:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

criarTarefaFinal();
