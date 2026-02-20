const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  console.log('Clearing existing data...');
  await prisma.$transaction([
    prisma.taskHistory.deleteMany(),
    prisma.attachment.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.dependency.deleteMany(),
    prisma.task.deleteMany(),
    prisma.project.deleteMany(),
    prisma.status.deleteMany(),
    prisma.priority.deleteMany(),
    prisma.user.deleteMany()
  ]);

  // Create users
  console.log('Creating users...');
  const users = await prisma.user.createManyAndReturn({
    data: [
      {
        name: 'Alexandre Bragato',
        email: 'alexandre@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=1',
        role: 'Admin'
      },
      {
        name: 'Maria Silva',
        email: 'maria@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=2',
        role: 'Editor'
      },
      {
        name: 'João Santos',
        email: 'joao@example.com',
        avatarUrl: 'https://i.pravatar.cc/150?img=3',
        role: 'Viewer'
      }
    ]
  });

  // Create statuses
  console.log('Creating statuses...');
  const statuses = await prisma.status.createManyAndReturn({
    data: [
      { name: 'Pendente', colorCode: '#FF6B6B', isFinalState: false, order: 1 },
      { name: 'Em Andamento', colorCode: '#4ECDC4', isFinalState: false, order: 2 },
      { name: 'Em Revisão', colorCode: '#FFD166', isFinalState: false, order: 3 },
      { name: 'Concluído', colorCode: '#06D6A0', isFinalState: true, order: 4 },
      { name: 'Bloqueado', colorCode: '#118AB2', isFinalState: false, order: 5 }
    ]
  });

  // Create priorities
  console.log('Creating priorities...');
  const priorities = await prisma.priority.createManyAndReturn({
    data: [
      { name: 'Baixa', weight: 1 },
      { name: 'Média', weight: 2 },
      { name: 'Alta', weight: 3 },
      { name: 'Crítica', weight: 4 }
    ]
  });

  // Create projects
  console.log('Creating projects...');
  const projects = await prisma.project.createManyAndReturn({
    data: [
      {
        name: 'Sistema de Gestão de Tarefas',
        description: 'Desenvolvimento do novo sistema de gestão de tarefas com React, Node.js e PostgreSQL',
        status: true,
        createdById: users[0].id
      },
      {
        name: 'Documentação Técnica',
        description: 'Criação da documentação completa do sistema incluindo API e frontend',
        status: true,
        createdById: users[1].id
      },
      {
        name: 'Marketing Digital',
        description: 'Campanha de marketing para lançamento do novo produto',
        status: true,
        createdById: users[0].id
      }
    ]
  });

  // Create tasks for first project
  console.log('Creating tasks for first project...');
  const tasksProject1 = await prisma.task.createManyAndReturn({
    data: [
      {
        title: 'Criar Componente de Lista de Tarefas',
        description: 'Desenvolver o componente principal que exibe a lista de tarefas com filtros e ordenação',
        deadline: new Date('2024-03-15T23:59:59Z'),
        position: 1,
        isCompleted: false,
        projectId: projects[0].id,
        statusId: statuses[1].id, // Em Andamento
        priorityId: priorities[2].id, // Alta
        createdById: users[0].id,
        assignedToId: users[1].id
      },
      {
        title: 'Implementar Sistema de Dependências',
        description: 'Criar a lógica para gerenciar dependências entre tarefas',
        deadline: new Date('2024-03-20T23:59:59Z'),
        position: 2,
        isCompleted: false,
        projectId: projects[0].id,
        statusId: statuses[0].id, // Pendente
        priorityId: priorities[3].id, // Crítica
        createdById: users[0].id,
        assignedToId: users[0].id
      },
      {
        title: 'Criar Componente de Subtarefas',
        description: 'Implementar a funcionalidade de subtarefas hierárquicas',
        deadline: new Date('2024-03-10T23:59:59Z'),
        position: 3,
        isCompleted: false,
        projectId: projects[0].id,
        statusId: statuses[0].id, // Pendente
        priorityId: priorities[1].id, // Média
        createdById: users[1].id,
        assignedToId: users[2].id,
        parentTaskId: null // Will update after creation
      }
    ]
  });

  // Update parent task reference
  await prisma.task.update({
    where: { id: tasksProject1[2].id },
    data: { parentTaskId: tasksProject1[0].id }
  });

  // Create tasks for second project
  console.log('Creating tasks for second project...');
  const tasksProject2 = await prisma.task.createManyAndReturn({
    data: [
      {
        title: 'Escrever Documentação de API',
        description: 'Documentar todos os endpoints da API REST',
        deadline: new Date('2024-02-28T23:59:59Z'),
        position: 1,
        isCompleted: true,
        projectId: projects[1].id,
        statusId: statuses[3].id, // Concluído
        priorityId: priorities[2].id, // Alta
        createdById: users[1].id,
        assignedToId: users[0].id
      },
      {
        title: 'Criar Guia de Instalação',
        description: 'Documentar passo a passo para instalação do sistema',
        deadline: new Date('2024-03-05T23:59:59Z'),
        position: 2,
        isCompleted: false,
        projectId: projects[1].id,
        statusId: statuses[1].id, // Em Andamento
        priorityId: priorities[1].id, // Média
        createdById: users[0].id,
        assignedToId: users[1].id
      }
    ]
  });

  // Create tasks for third project
  console.log('Creating tasks for third project...');
  await prisma.task.createMany({
    data: [
      {
        title: 'Criar Estratégia de Conteúdo',
        description: 'Desenvolver calendário editorial e temas para posts',
        deadline: new Date('2024-03-25T23:59:59Z'),
        position: 1,
        isCompleted: false,
        projectId: projects[2].id,
        statusId: statuses[0].id, // Pendente
        priorityId: priorities[2].id, // Alta
        createdById: users[0].id,
        assignedToId: users[1].id
      },
      {
        title: 'Configurar Anúncios no Google Ads',
        description: 'Criar campanhas de anúncios patrocinados',
        deadline: new Date('2024-03-30T23:59:59Z'),
        position: 2,
        isCompleted: false,
        projectId: projects[2].id,
        statusId: statuses[0].id, // Pendente
        priorityId: priorities[1].id, // Média
        createdById: users[1].id,
        assignedToId: users[2].id
      }
    ]
  });

  // Create some comments
  console.log('Creating comments...');
  await prisma.comment.createMany({
    data: [
      {
        content: 'Precisamos adicionar suporte para drag and drop na lista',
        taskId: tasksProject1[0].id,
        userId: users[0].id
      },
      {
        content: 'Concordo, vou pesquisar sobre react-dnd',
        taskId: tasksProject1[0].id,
        userId: users[1].id
      },
      {
        content: 'A documentação da API está quase pronta, falta apenas a seção de autenticação',
        taskId: tasksProject2[0].id,
        userId: users[0].id
      }
    ]
  });

  // Create a dependency
  console.log('Creating dependencies...');
  await prisma.dependency.create({
    data: {
      type: 'BLOCKING',
      taskId: tasksProject1[1].id,
      dependentTaskId: tasksProject1[0].id
    }
  });

  console.log('✅ Database seeding completed successfully!');
  console.log(`📊 Created: ${users.length} users, ${statuses.length} statuses, ${priorities.length} priorities`);
  console.log(`📊 Created: ${projects.length} projects, ${tasksProject1.length + tasksProject2.length + 2} tasks`);
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });