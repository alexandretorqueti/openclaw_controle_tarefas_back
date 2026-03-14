/**
 * Testes simples de integração para TaskService
 * Foco em funcionalidades críticas com banco em memória
 */

const taskService = require('../src/services/taskService');
const { prisma, setupTestDatabase } = require('./setup');

describe('TaskService - Testes Essenciais', () => {
  let testData;

  beforeEach(async () => {
    testData = await setupTestDatabase();
  });

  describe('getNextTaskForUser', () => {
    it('deve retornar próxima tarefa para usuário', async () => {
      const { testProject, users, statuses, priorities } = testData;
      const { testUser1, testUser2 } = users;
      
      // Criar tarefa atribuída ao testUser2
      await prisma.task.create({
        data: {
          title: 'Próxima Tarefa',
          description: 'Deve ser retornada',
          projectId: testProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: priorities.highPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 3600000)
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      expect(nextTask).toBeDefined();
      expect(nextTask.title).toBe('Próxima Tarefa');
      expect(nextTask.assignedToId).toBe(testUser2.id);
    });

    it('deve filtrar tarefas de projetos inativos', async () => {
      const { users, statuses, priorities } = testData;
      const { testUser1, testUser2 } = users;
      
      // Criar projeto INATIVO
      const inactiveProject = await prisma.project.create({
        data: {
          name: 'Projeto Inativo',
          description: 'Projeto inativo para teste',
          status: false,
          ativo: false,
          createdById: testUser1.id
        }
      });

      // Criar tarefa em projeto inativo
      await prisma.task.create({
        data: {
          title: 'Tarefa em Projeto Inativo',
          description: 'NÃO deve ser retornada',
          projectId: inactiveProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: priorities.highPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 86400000)
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      // Não deve retornar tarefa de projeto inativo
      expect(nextTask).toBeNull();
    });

    it('deve priorizar tarefas por peso de prioridade', async () => {
      const { testProject, users, statuses } = testData;
      const { testUser1, testUser2 } = users;
      
      const priorities = await prisma.priority.findMany();
      const lowPriority = priorities.find(p => p.name === 'Baixa');
      const highPriority = priorities.find(p => p.name === 'Alta');

      // Criar tarefa com prioridade Baixa
      await prisma.task.create({
        data: {
          title: 'Tarefa Baixa Prioridade',
          description: 'Prioridade 1',
          projectId: testProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: lowPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 3600000)
        }
      });

      // Criar tarefa com prioridade Alta
      await prisma.task.create({
        data: {
          title: 'Tarefa Alta Prioridade',
          description: 'Prioridade 3',
          projectId: testProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: highPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 7200000)
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      // Deve retornar a tarefa com prioridade Alta
      expect(nextTask).toBeDefined();
      expect(nextTask.title).toBe('Tarefa Alta Prioridade');
      expect(nextTask.priority.name).toBe('Alta');
    });

    it('deve retornar null quando não há tarefas elegíveis', async () => {
      const { testUser2 } = testData.users;
      
      const nextTask = await taskService.getNextTaskForUser('testuser2');
      expect(nextTask).toBeNull();
    });
  });

  describe('createTask', () => {
    it('deve criar uma tarefa com sucesso', async () => {
      const { testProject, users, statuses, priorities } = testData;
      const { testUser1, testUser2 } = users;
      
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descrição da nova tarefa',
        projectId: testProject.id,
        statusId: statuses.pendingStatus.id,
        priorityId: priorities.highPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        deadline: new Date(Date.now() + 86400000)
      };

      const createdTask = await taskService.createTask(taskData);
      
      expect(createdTask).toBeDefined();
      expect(createdTask.title).toBe('Nova Tarefa');
      
      // Verificar se foi criada no banco
      const taskInDb = await prisma.task.findUnique({
        where: { id: createdTask.id }
      });
      
      expect(taskInDb).toBeDefined();
      expect(taskInDb.title).toBe('Nova Tarefa');
    });

    it('deve lançar erro ao criar tarefa com referências inválidas', async () => {
      const invalidData = {
        title: 'Tarefa Inválida',
        description: 'Tentativa com IDs inválidos',
        projectId: '00000000-0000-0000-0000-000000000000',
        statusId: '00000000-0000-0000-0000-000000000000',
        priorityId: '00000000-0000-0000-0000-000000000000',
        createdById: '00000000-0000-0000-0000-000000000000',
        assignedToId: '00000000-0000-0000-0000-000000000000',
        deadline: new Date()
      };

      await expect(taskService.createTask(invalidData))
        .rejects.toThrow();
    });
  });
});