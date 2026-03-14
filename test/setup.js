/**
 * Configuração de testes com banco em memória
 * 
 * Para usar: 
 * 1. Rodar testes: npm test
 * 2. Rodar teste específico: npx jest test/taskService.test.js
 */

const { PrismaClient } = require('@prisma/client');
const path = require('path');

// Configurar banco em memória para testes
process.env.DATABASE_URL = 'file:test.db?mode=memory&cache=shared';

// Criar instância do Prisma para testes
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'test' ? [] : ['query', 'info', 'warn', 'error']
});

// Função para limpar banco antes de cada teste
async function clearDatabase() {
  const models = Object.keys(prisma).filter(key => !key.startsWith('_') && !key.startsWith('$'));
  
  // Ordem específica para evitar erros de constraint
  const deleteOrder = [
    'taskHistory',
    'attachment',
    'comment',
    'dependency',
    'taskExecutionLog',
    'task',
    'project',
    'projectType',
    'status',
    'priority',
    'user',
    'log',
    'agentAvatar'
  ];
  
  for (const modelName of deleteOrder) {
    if (prisma[modelName]) {
      try {
        await prisma[modelName].deleteMany({});
      } catch (error) {
        // Ignorar erros de tabela não existente
        if (!error.message.includes('no such table')) {
          console.warn(`Erro ao limpar ${modelName}:`, error.message);
        }
      }
    }
  }
}

// Função para criar dados de teste padrão
async function createTestData() {
  // Criar usuários de teste
  const testUser1 = await prisma.user.create({
    data: {
      name: 'Test User 1',
      nickname: 'testuser1',
      email: 'test1@example.com',
      role: 'Admin'
    }
  });

  const testUser2 = await prisma.user.create({
    data: {
      name: 'Test User 2',
      nickname: 'testuser2',
      email: 'test2@example.com',
      role: 'Editor'
    }
  });

  // Criar status
  const pendingStatus = await prisma.status.create({
    data: {
      name: 'Pendente',
      order: 1,
      colorCode: '#9E9E9E',
      isFinalState: false,
      visibleToAi: true
    }
  });

  const inProgressStatus = await prisma.status.create({
    data: {
      name: 'Em Andamento',
      order: 2,
      colorCode: '#2196F3',
      isFinalState: false,
      visibleToAi: false
    }
  });

  const completedStatus = await prisma.status.create({
    data: {
      name: 'Programação Finalizada',
      order: 3,
      colorCode: '#4CAF50',
      isFinalState: true,
      visibleToAi: false
    }
  });

  // Criar prioridades
  const lowPriority = await prisma.priority.create({
    data: {
      name: 'Baixa',
      weight: 1
    }
  });

  const mediumPriority = await prisma.priority.create({
    data: {
      name: 'Média',
      weight: 2
    }
  });

  const highPriority = await prisma.priority.create({
    data: {
      name: 'Alta',
      weight: 3
    }
  });

  // Criar tipo de projeto
  const projectType = await prisma.projectType.create({
    data: {
      name: 'Sistema Web',
      personaPrompt: 'Arquiteto de software especializado em sistemas web',
      baseRules: '# Regras para Sistemas Web\n\n## Stack Recomendada\n- Frontend: React com TypeScript\n- Backend: Node.js + Express'
    }
  });

  // Criar projeto
  const testProject = await prisma.project.create({
    data: {
      name: 'Projeto Teste',
      description: 'Projeto para testes unitários',
      status: true,
      ativo: true,
      createdById: testUser1.id,
      projectTypeId: projectType.id,
      pastaBase: '/tmp/test',
      frontendPath: 'frontend-test',
      backendPath: 'backend-test'
    }
  });

  return {
    users: { testUser1, testUser2 },
    statuses: { pendingStatus, inProgressStatus, completedStatus },
    priorities: { lowPriority, mediumPriority, highPriority },
    projectType,
    testProject
  };
}

// Configurações do Jest
if (typeof jest !== 'undefined') {
  // Configurar timeout global
  jest.setTimeout(30000);

  // Hooks do Jest
  beforeAll(async () => {
    // Garantir que as migrações estão aplicadas
    try {
      await prisma.$connect();
      await prisma.$executeRaw`PRAGMA foreign_keys = OFF`;
    } catch (error) {
      console.error('Erro ao conectar ao banco de testes:', error.message);
    }
  });

  beforeEach(async () => {
    await clearDatabase();
  });

  afterEach(async () => {
    // Limpar após cada teste
    await clearDatabase();
  });

  afterAll(async () => {
    // Desconectar do banco
    await prisma.$disconnect();
  });
}

module.exports = {
  prisma,
  clearDatabase,
  createTestData,
  setupTestDatabase: async () => {
    await clearDatabase();
    return await createTestData();
  }
};