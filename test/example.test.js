/**
 * Exemplo de teste usando banco em memória
 */

const { prisma, setupTestDatabase } = require('./setup');
const TaskService = require('../src/services/taskService');

describe('Exemplo de Teste com Banco em Memória', () => {
  let testData;
  let taskService;

  beforeAll(async () => {
    taskService = new TaskService();
  });

  beforeEach(async () => {
    // Configurar banco em memória e criar dados de teste
    testData = await setupTestDatabase();
  });

  afterEach(async () => {
    // O setup.js já limpa automaticamente
  });

  test('deve criar uma tarefa com sucesso', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    const taskData = {
      title: 'Tarefa de Teste',
      description: 'Descrição da tarefa de teste',
      projectId: testProject.id,
      statusId: statuses.pendingStatus.id,
      priorityId: priorities.mediumPriority.id,
      createdById: users.testUser1.id,
      assignedToId: users.testUser2.id,
      deadline: new Date(Date.now() + 86400000) // 1 dia
    };

    // Criar tarefa usando o serviço
    const task = await taskService.createTask(taskData);

    // Verificações
    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.title).toBe(taskData.title);
    expect(task.description).toBe(taskData.description);
    expect(task.projectId).toBe(testProject.id);
    expect(task.statusId).toBe(statuses.pendingStatus.id);
    expect(task.priorityId).toBe(priorities.mediumPriority.id);
    expect(task.createdById).toBe(users.testUser1.id);
    expect(task.assignedToId).toBe(users.testUser2.id);
    
    // Verificar se foi salvo no banco
    const savedTask = await prisma.task.findUnique({
      where: { id: task.id }
    });
    
    expect(savedTask).toBeDefined();
    expect(savedTask.title).toBe(taskData.title);
  });

  test('deve validar referências ao criar tarefa', async () => {
    const { users, statuses, priorities } = testData;
    
    const taskData = {
      title: 'Tarefa com Referências Inválidas',
      description: 'Esta tarefa deve falhar na validação',
      projectId: 'id-inexistente', // ID inválido
      statusId: statuses.pendingStatus.id,
      priorityId: priorities.mediumPriority.id,
      createdById: users.testUser1.id,
      assignedToId: users.testUser2.id,
      deadline: new Date()
    };

    // Deve lançar erro de validação
    await expect(taskService.createTask(taskData))
      .rejects
      .toThrow();
  });

  test('deve buscar próxima tarefa para usuário', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    // Criar algumas tarefas
    const task1 = await prisma.task.create({
      data: {
        title: 'Tarefa 1',
        description: 'Primeira tarefa',
        projectId: testProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.highPriority.id,
        createdById: users.testUser1.id,
        assignedToId: users.testUser2.id,
        deadline: new Date(Date.now() + 3600000) // 1 hora
      }
    });

    const task2 = await prisma.task.create({
      data: {
        title: 'Tarefa 2',
        description: 'Segunda tarefa',
        projectId: testProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.mediumPriority.id,
        createdById: users.testUser1.id,
        assignedToId: users.testUser2.id,
        deadline: new Date(Date.now() + 7200000) // 2 horas
      }
    });

    // Buscar próxima tarefa
    const nextTask = await taskService.getNextTaskForUser('testuser2');
    
    expect(nextTask).toBeDefined();
    // Deve retornar a tarefa com maior prioridade (High > Medium)
    expect(nextTask.id).toBe(task1.id);
    expect(nextTask.title).toBe('Tarefa 1');
  });

  test('não deve retornar tarefas de projetos inativos', async () => {
    const { users, statuses, priorities } = testData;
    
    // Criar projeto inativo
    const inactiveProject = await prisma.project.create({
      data: {
        name: 'Projeto Inativo',
        description: 'Projeto desativado para testes',
        status: false,
        ativo: false,
        createdById: users.testUser1.id
      }
    });

    // Criar tarefa em projeto inativo
    await prisma.task.create({
      data: {
        title: 'Tarefa em Projeto Inativo',
        description: 'Não deve aparecer na busca',
        projectId: inactiveProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.highPriority.id,
        createdById: users.testUser1.id,
        assignedToId: users.testUser2.id,
        deadline: new Date()
      }
    });

    // Buscar próxima tarefa - não deve encontrar
    const nextTask = await taskService.getNextTaskForUser('testuser2');
    
    expect(nextTask).toBeNull();
  });

  test('deve atualizar status de tarefa', async () => {
    const { testProject, users, statuses, priorities } = testData;
    
    // Criar tarefa
    const task = await prisma.task.create({
      data: {
        title: 'Tarefa para Atualizar',
        description: 'Vamos atualizar o status',
        projectId: testProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.mediumPriority.id,
        createdById: users.testUser1.id,
        assignedToId: users.testUser2.id,
        deadline: new Date()
      }
    });

    // Atualizar status
    const updatedTask = await prisma.task.update({
      where: { id: task.id },
      data: {
        statusId: statuses.inProgressStatus.id
      },
      include: { status: true }
    });

    expect(updatedTask.statusId).toBe(statuses.inProgressStatus.id);
    expect(updatedTask.status.name).toBe('Em Andamento');
    
    // Verificar se foi criado histórico
    const history = await prisma.taskHistory.findFirst({
      where: { taskId: task.id }
    });
    
    expect(history).toBeDefined();
    expect(history.oldStatusId).toBe(statuses.pendingStatus.id);
    expect(history.newStatusId).toBe(statuses.inProgressStatus.id);
  });
});