// Script simples para testar se há tarefas
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verificarTarefas() {
  try {
    // Verificar status disponíveis
    const statusList = await prisma.status.findMany();
    console.log('Status disponíveis:', statusList.map(s => ({ id: s.id, name: s.name })));
    
    // Verificar prioridades
    const priorities = await prisma.priority.findMany();
    console.log('Prioridades disponíveis:', priorities.map(p => ({ id: p.id, name: p.name })));
    
    // Verificar tarefas existentes
    const tasks = await prisma.task.findMany({
      take: 5,
      include: {
        status: true,
        priority: true,
        project: true
      }
    });
    
    console.log(`\nTarefas existentes (${tasks.length}):`);
    tasks.forEach(task => {
      console.log(`- ${task.id}: ${task.title} (${task.status?.name || 'sem status'})`);
    });
    
    // Verificar se há tarefas PENDING para jarbas
    const pendingTasks = await prisma.task.findMany({
      where: {
        assignedTo: { nickname: 'jarbas' },
        status: { name: 'PENDING' }
      },
      include: {
        status: true,
        project: true
      }
    });
    
    console.log(`\nTarefas PENDING para jarbas: ${pendingTasks.length}`);
    
  } catch (error) {
    console.error('Erro:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verificarTarefas();
