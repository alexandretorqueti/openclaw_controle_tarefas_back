const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function criarTarefaTeste() {
  try {
    // Primeiro, verificar se há um projeto
    let projeto = await prisma.project.findFirst();
    
    if (!projeto) {
      console.log('Criando projeto de teste...');
      projeto = await prisma.project.create({
        data: {
          name: 'Projeto Teste Monitor',
          description: 'Projeto para testar o monitor de tarefas',
          regras: '{}',
          frontendPath: 'frontend',
          backendPath: 'backend',
          pastaBase: '/home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server'
        }
      });
    }
    
    // Verificar se há um usuário jarbas
    let usuario = await prisma.user.findUnique({
      where: { nickname: 'jarbas' }
    });
    
    if (!usuario) {
      console.log('Criando usuário jarbas...');
      usuario = await prisma.user.create({
        data: {
          name: 'Jarbas',
          nickname: 'jarbas',
          email: 'jarbas@teste.com',
          role: 'USER'
        }
      });
    }
    
    // Criar tarefa de teste
    console.log('Criando tarefa de teste...');
    const tarefa = await prisma.task.create({
      data: {
        title: 'Tarefa Teste Monitor - Corrigir bug no componente',
        description: 'Testar o fluxo completo do monitor. O componente Button não está renderizando corretamente no mobile.',
        projectId: projeto.id,
        createdById: usuario.id,
        assignedToId: usuario.id,
        statusId: 1, // PENDING
        priorityId: 2, // MEDIUM
        domain: 'FRONTEND',
        estimatedHours: 2,
        weight: 3,
        deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 dias a partir de agora
      },
      include: {
        project: true,
        comments: {
          include: {
            user: true
          }
        }
      }
    });
    
    // Adicionar um comentário de teste
    await prisma.comment.create({
      data: {
        content: 'Este é um comentário de teste para verificar se a seção de comentários está funcionando.',
        taskId: tarefa.id,
        userId: usuario.id
      }
    });
    
    console.log('✅ Tarefa criada com sucesso:');
    console.log(`ID: ${tarefa.id}`);
    console.log(`Título: ${tarefa.title}`);
    console.log(`Projeto: ${tarefa.project.name}`);
    console.log(`Domínio: ${tarefa.domain}`);
    
    return tarefa;
    
  } catch (error) {
    console.error('Erro ao criar tarefa:', error);
  } finally {
    await prisma.$disconnect();
  }
}

criarTarefaTeste();
