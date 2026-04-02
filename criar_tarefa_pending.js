const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function criarTarefaPending() {
  try {
    // Buscar usuário jarbas
    const usuario = await prisma.user.findUnique({
      where: { nickname: 'jarbas' }
    });
    
    if (!usuario) {
      console.error('Usuário jarbas não encontrado');
      return;
    }
    
    // Buscar status "Pendente"
    const statusPendente = await prisma.status.findFirst({
      where: { name: 'Pendente' }
    });
    
    if (!statusPendente) {
      console.error('Status "Pendente" não encontrado');
      return;
    }
    
    // Buscar prioridade "Média"
    const prioridadeMedia = await prisma.priority.findFirst({
      where: { name: 'Média' }
    });
    
    if (!prioridadeMedia) {
      console.error('Prioridade "Média" não encontrada');
      return;
    }
    
    // Buscar primeiro projeto
    const projeto = await prisma.project.findFirst();
    
    if (!projeto) {
      console.error('Nenhum projeto encontrado');
      return;
    }
    
    // Criar tarefa PENDING
    console.log('Criando tarefa PENDING para teste...');
    const tarefa = await prisma.task.create({
      data: {
        title: 'TESTE MONITOR: Corrigir componente Button no frontend',
        description: 'Tarefa de teste para verificar o fluxo completo do monitor. O componente Button apresenta problemas de renderização em dispositivos móveis. Verificar CSS responsivo e ajustar breakpoints.',
        projectId: projeto.id,
        createdById: usuario.id,
        assignedToId: usuario.id,
        statusId: statusPendente.id,
        priorityId: prioridadeMedia.id,
        domain: 'FRONTEND',
        estimatedHours: 3,
        weight: 2,
        deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 dias
      }
    });
    
    console.log('✅ Tarefa PENDING criada:');
    console.log(`ID: ${tarefa.id}`);
    console.log(`Título: ${tarefa.title}`);
    console.log(`Status: Pendente`);
    console.log(`Domínio: ${tarefa.domain}`);
    
    // Adicionar comentário
    await prisma.comment.create({
      data: {
        content: 'Esta é uma tarefa de teste para validar o fluxo completo do monitor de tarefas. Por favor, processar normalmente.',
        taskId: tarefa.id,
        userId: usuario.id
      }
    });
    
    console.log('💬 Comentário adicionado');
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

criarTarefaPending();
