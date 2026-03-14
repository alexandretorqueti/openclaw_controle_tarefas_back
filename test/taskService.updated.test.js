const TaskService = require('../src/services/taskService');
const { prisma, setupTestDatabase } = require('./setup');

describe('TaskService - Reference Validation (Banco em Memória)', () => {
  let testData;
  let taskService;

  beforeAll(async () => {
    taskService = new TaskService();
  });

  beforeEach(async () => {
    // Configurar banco em memória e criar dados de teste
    testData = await setupTestDatabase();
  });

  // Helper para acessar dados de teste
  const getTestData = () => {
    const { testProject, users, statuses, priorities } = testData;
    return {
      testProject,
      testUser1: users.testUser1,
      testUser2: users.testUser2,
      testStatus: statuses.pendingStatus,
      testPriority: priorities.mediumPriority
    };
  };

  describe('validateReferences', () => {
    it('should validate all references successfully', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      // Criar tarefa pai primeiro
      const parentTask = await prisma.task.create({
        data: {
          title: 'Tarefa Pai',
          description: 'Tarefa pai para teste',
          projectId: testProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const validData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: parentTask.id
      };

      await expect(taskService.validateReferences(validData)).resolves.not.toThrow();
    });

    it('should throw error for non-existent project', async () => {
      const { testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      const invalidData = {
        projectId: '00000000-0000-0000-0000-000000000000',
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Project with ID .* not found/
      );
    });

    it('should throw error for non-existent status', async () => {
      const { testProject, testUser1, testUser2, testPriority } = getTestData();
      
      const invalidData = {
        projectId: testProject.id,
        statusId: '00000000-0000-0000-0000-000000000000',
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Status with ID .* not found/
      );
    });

    it('should throw error for non-existent priority', async () => {
      const { testProject, testUser1, testUser2, testStatus } = getTestData();
      
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: '00000000-0000-0000-0000-000000000000',
        createdById: testUser1.id,
        assignedToId: testUser2.id
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Priority with ID .* not found/
      );
    });

    it('should throw error for non-existent creator', async () => {
      const { testProject, testUser2, testStatus, testPriority } = getTestData();
      
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: '00000000-0000-0000-0000-000000000000',
        assignedToId: testUser2.id
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Creator with ID .* not found/
      );
    });

    it('should throw error for non-existent assignee', async () => {
      const { testProject, testUser1, testStatus, testPriority } = getTestData();
      
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: '00000000-0000-0000-0000-000000000000'
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Assignee with ID .* not found/
      );
    });

    it('should throw error for non-existent parent task', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      const invalidData = {
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: '00000000-0000-0000-0000-000000000000'
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Parent task with ID .* not found/
      );
    });

    it('should throw error for parent task in different project', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      // Criar outro projeto
      const otherProject = await prisma.project.create({
        data: {
          name: 'Outro Projeto',
          description: 'Projeto diferente',
          status: true,
          ativo: true,
          createdById: testUser1.id
        }
      });

      // Criar tarefa em outro projeto
      const parentTask = await prisma.task.create({
        data: {
          title: 'Tarefa em Outro Projeto',
          description: 'Tarefa pai em projeto diferente',
          projectId: otherProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const invalidData = {
        projectId: testProject.id, // Projeto diferente da tarefa pai
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: parentTask.id
      };

      await expect(taskService.validateReferences(invalidData)).rejects.toThrow(
        /Parent task belongs to different project/
      );
    });
  });

  describe('createTask', () => {
    it('should create a task with valid references', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descrição da nova tarefa',
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        deadline: new Date(Date.now() + 86400000) // 1 dia
      };

      const task = await taskService.createTask(taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.title).toBe(taskData.title);
      expect(task.description).toBe(taskData.description);
      expect(task.projectId).toBe(testProject.id);
      expect(task.statusId).toBe(testStatus.id);
      expect(task.priorityId).toBe(testPriority.id);
      expect(task.createdById).toBe(testUser1.id);
      expect(task.assignedToId).toBe(testUser2.id);

      // Verificar se foi salvo no banco
      const savedTask = await prisma.task.findUnique({
        where: { id: task.id }
      });
      
      expect(savedTask).toBeDefined();
      expect(savedTask.title).toBe(taskData.title);
    });

    it('should create a subtask with valid parent', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      // Criar tarefa pai
      const parentTask = await prisma.task.create({
        data: {
          title: 'Tarefa Pai',
          description: 'Tarefa pai para subtask',
          projectId: testProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const subtaskData = {
        title: 'Subtask',
        description: 'Descrição da subtask',
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        parentTaskId: parentTask.id,
        deadline: new Date(Date.now() + 43200000) // 12 horas
      };

      const subtask = await taskService.createTask(subtaskData);

      expect(subtask).toBeDefined();
      expect(subtask.id).toBeDefined();
      expect(subtask.parentTaskId).toBe(parentTask.id);

      // Verificar dependência criada
      const dependency = await prisma.dependency.findFirst({
        where: {
          taskId: subtask.id,
          dependsOnId: parentTask.id
        }
      });

      expect(dependency).toBeDefined();
    });

    it('should handle task with dependencies', async () => {
      const { testProject, testUser1, testUser2, testStatus, testPriority } = getTestData();
      
      // Criar tarefas dependentes
      const task1 = await prisma.task.create({
        data: {
          title: 'Tarefa 1',
          description: 'Primeira tarefa',
          projectId: testProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const task2 = await prisma.task.create({
        data: {
          title: 'Tarefa 2',
          description: 'Segunda tarefa',
          projectId: testProject.id,
          statusId: testStatus.id,
          priorityId: testPriority.id,
          createdById: testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const taskData = {
        title: 'Tarefa com Dependências',
        description: 'Depende de outras tarefas',
        projectId: testProject.id,
        statusId: testStatus.id,
        priorityId: testPriority.id,
        createdById: testUser1.id,
        assignedToId: testUser2.id,
        dependencyIds: [task1.id, task2.id],
        deadline: new Date(Date.now() + 172800000) // 2 dias
      };

      const task = await taskService.createTask(taskData);

      expect(task).toBeDefined();

      // Verificar dependências criadas
      const dependencies = await prisma.dependency.findMany({
        where: { taskId: task.id }
      });

      expect(dependencies).toHaveLength(2);
      expect(dependencies.map(d => d.dependsOnId)).toEqual(
        expect.arrayContaining([task1.id, task2.id])
      );
    });
  });

  describe('getNextTaskForUser', () => {
    it('should return next task for user with AI-visible status', async () => {
      const { testProject, users, statuses, priorities } = testData;
      const { testUser2 } = users;
      
      // Criar tarefa com status visível para IA (Pendente)
      await prisma.task.create({
        data: {
          title: 'Tarefa Pendente para IA',
          description: 'Deve aparecer na busca',
          projectId: testProject.id,
          statusId: statuses.pendingStatus.id, // visibleToAi: true
          priorityId: priorities.highPriority.id,
          createdById: users.testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 3600000)
        }
      });

      // Criar tarefa com status NÃO visível para IA (Em Andamento)
      await prisma.task.create({
        data: {
          title: 'Tarefa Em Andamento',
          description: 'NÃO deve aparecer na busca',
          projectId: testProject.id,
          statusId: statuses.inProgressStatus.id, // visibleToAi: false
          priorityId: priorities.highPriority.id,
          createdById: users.testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 3600000)
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      expect(nextTask).toBeDefined();
      expect(nextTask.title).toBe('Tarefa Pendente para IA');
      expect(nextTask.status.name).toBe('Pendente');
    });

    it('should not return tasks from inactive projects', async () => {
      const { users, statuses, priorities } = testData;
      const { testUser2 } = users;
      
      // Criar projeto inativo
      const inactiveProject = await prisma.project.create({
        data: {
          name: 'Projeto Inativo',
          description: 'Projeto desativado',
          status: false,
          ativo: false,
          createdById: users.testUser1.id
        }
      });

      // Criar tarefa em projeto inativo
      await prisma.task.create({
        data: {
          title: 'Tarefa em Projeto Inativo',
          description: 'NÃO deve aparecer',
          projectId: inactiveProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: priorities.highPriority.id,
          createdById: users.testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date()
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      expect(nextTask).toBeNull();
    });

    it('should prioritize higher priority tasks', async () => {
      const { testProject, users, statuses, priorities } = testData;
      const { testUser2 } = users;
      
      // Criar tarefa com prioridade Baixa
      await prisma.task.create({
        data: {
          title: 'Tarefa Baixa Prioridade',
          description: 'Prioridade 1',
          projectId: testProject.id,
          statusId: statuses.pendingStatus.id,
          priorityId: priorities.lowPriority.id, // weight: 1
          createdById: users.testUser1.id,
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
          priorityId: priorities.highPriority.id, // weight: 3
          createdById: users.testUser1.id,
          assignedToId: testUser2.id,
          deadline: new Date(Date.now() + 7200000)
        }
      });

      const nextTask = await taskService.getNextTaskForUser('testuser2');
      
      expect(nextTask).toBeDefined();
      expect(nextTask.title).toBe('Tarefa Alta Prioridade');
      expect(nextTask.priority.name).toBe('Alta');
    });
  });
});