const prisma = require('../src/services/prismaService');

async function main() {
  // Statuses
  await prisma.status.upsert({
    where: { name: 'Pendente' },
    update: {},
    create: { name: 'Pendente', color: '#FFA500' }
  });
  await prisma.status.upsert({
    where: { name: 'Em Andamento' },
    update: {},
    create: { name: 'Em Andamento', color: '#1E90FF' }
  });
  await prisma.status.upsert({
    where: { name: 'Concluído' },
    update: {},
    create: { name: 'Concluído', color: '#32CD32' }
  });

  // Priorities
  await prisma.priority.upsert({
    where: { name: 'Baixa' },
    update: {},
    create: { name: 'Baixa', color: '#90EE90' }
  });
  await prisma.priority.upsert({
    where: { name: 'Média' },
    update: {},
    create: { name: 'Média', color: '#FFD700' }
  });
  await prisma.priority.upsert({
    where: { name: 'Alta' },
    update: {},
    create: { name: 'Alta', color: '#FF4500' }
  });

  // User admin
  await prisma.user.upsert({
    where: { nickname: 'admin' },
    update: {},
    create: {
      name: 'Admin Test',
      email: 'admin@test.com',
      nickname: 'admin',
      role: 'ADMIN',
      avatarUrl: null
    }
  });

  // Project test
  await prisma.project.upsert({
    where: { name: 'Test Project' },
    update: {},
    create: {
      name: 'Test Project',
      description: 'Projeto de teste',
      frontendPath: '/tmp/test-frontend',
      backendPath: '/tmp/test-backend'
    }
  });

  // Agent test
  await prisma.agent.upsert({
    where: { name: 'Test Agent' },
    update: {},
    create: {
      name: 'Test Agent',
      description: 'Agente de teste',
      avatarUrl: null
    }
  });

  console.log('✅ Seed completed');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });