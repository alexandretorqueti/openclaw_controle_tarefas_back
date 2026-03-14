/**
 * Teste simples para verificar configuração do banco em memória
 */

const taskService = require('../src/services/taskService');
const { prisma, setupTestDatabase } = require('./setup');

describe('Teste Simples com Banco em Memória', () => {
  let testData;

  beforeEach(async () => {
    // Configurar banco em memória e criar dados de teste
    testData = await setupTestDatabase();
  });

  test('deve conectar ao banco em memória', async () => {
    // Verificar se podemos acessar o banco
    const users = await prisma.user.findMany();
    expect(Array.isArray(users)).toBe(true);
  });

  test('deve criar um usuário', async () => {
    const user = await prisma.user.create({
      data: {
        name: 'Usuário Teste',
        nickname: 'testuser',
        email: 'test@example.com',
        role: 'Viewer'
      }
    });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.nickname).toBe('testuser');
  });

  test('deve buscar usuário por nickname', async () => {
    const { users } = testData;
    
    const foundUser = await prisma.user.findUnique({
      where: { nickname: 'testuser1' }
    });

    expect(foundUser).toBeDefined();
    expect(foundUser.nickname).toBe('testuser1');
    expect(foundUser.name).toBe('Test User 1');
  });

  test('deve criar uma tarefa simples', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    const task = await prisma.task.create({
      data: {
        title: 'Tarefa Simples',
        description: 'Descrição da tarefa',
        projectId: testProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.mediumPriority.id,
        createdById: users.testUser1.id,
        assignedToId: users.testUser2.id,
        deadline: new Date()
      }
    });

    expect(task).toBeDefined();
    expect(task.title).toBe('Tarefa Simples');
    expect(task.projectId).toBe(testProject.id);
  });

  test('deve validar referências com taskService', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    const validData = {
      projectId: testProject.id,
      statusId: statuses.pendingStatus.id,
      priorityId: priorities.mediumPriority.id,
      createdById: users.testUser1.id,
      assignedToId: users.testUser2.id
    };

    // taskService.validateReferences deve existir
    expect(taskService.validateReferences).toBeDefined();
    
    // Deve validar sem erro
    await expect(taskService.validateReferences(validData))
      .resolves
      .not.toThrow();
  });

  test('deve falhar na validação com ID inválido', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    const invalidData = {
      projectId: '00000000-0000-0000-0000-000000000000', // ID inválido
      statusId: statuses.pendingStatus.id,
      priorityId: priorities.mediumPriority.id,
      createdById: users.testUser1.id,
      assignedToId: users.testUser2.id
    };

    await expect(taskService.validateReferences(invalidData))
      .rejects
      .toThrow(/Project with ID .* not found/);
  });
});