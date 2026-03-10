// test/taskController.test.js
// Testes unitarios para TaskController (Sistema de Auth Simplificado)

// Mock do prismaService - deve vir antes dos imports
jest.mock('../src/services/prismaService', () => ({
  user: {
    findUnique: jest.fn()
  }
}));

// Mock do taskService
jest.mock('../src/services/taskService', () => ({
  createTask: jest.fn(),
  getAllTasks: jest.fn(),
  getTaskById: jest.fn(),
  updateTask: jest.fn(),
  deleteTask: jest.fn(),
  getTasksByProject: jest.fn(),
  getNextTaskForUser: jest.fn(),
  updateTaskPosition: jest.fn(),
  toggleTaskCompletion: jest.fn(),
  finalizeTask: jest.fn()
}));

const TaskController = require('../src/controllers/taskController');
const taskService = require('../src/services/taskService');
const prisma = require('../src/services/prismaService');

describe('TaskController', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockReq = {
      body: {},
      params: {},
      query: {},
      headers: {},
      user: null,
      correlationId: 'test-correlation-id'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('createTask', () => {
    test('deve criar tarefa com sucesso usando createdById no body', async () => {
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descricao da tarefa',
        projectId: 'proj-123',
        statusId: 'status-123',
        priorityId: 'priority-123',
        deadline: '2024-12-31',
        createdById: 'user-123',
        assignedToId: 'user-123'
      };
      
      mockReq.body = taskData;
      taskService.createTask.mockResolvedValue({ id: 'task-123', ...taskData });
      
      await TaskController.createTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task created successfully',
          task: expect.any(Object)
        })
      );
    });

    test('deve criar tarefa usando nickname no body', async () => {
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descricao',
        projectId: 'proj-123',
        statusId: 'status-123',
        priorityId: 'priority-123',
        nickname: 'testuser'
      };
      
      mockReq.body = taskData;
      
      // Mock do prisma para retornar usuário pelo nickname
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        name: 'Test User',
        nickname: 'testuser'
      });
      
      taskService.createTask.mockResolvedValue({ id: 'task-123', ...taskData, createdById: 'user-123' });
      
      await TaskController.createTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    test('deve rejeitar sem identificacao de usuario', async () => {
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descricao',
        projectId: 'proj-123',
        statusId: 'status-123',
        priorityId: 'priority-123'
      };
      
      mockReq.body = taskData;
      
      // Mock do prisma para não encontrar usuário
      prisma.user.findUnique.mockResolvedValue(null);
      
      await TaskController.createTask(mockReq, mockRes, mockNext);
      
      // Deve chamar next com erro (erro 400)
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });
  });

  describe('getAllTasks', () => {
    test('deve retornar lista de tarefas', async () => {
      const tasks = [
        { id: 'task-1', title: 'Tarefa 1' },
        { id: 'task-2', title: 'Tarefa 2' }
      ];
      
      taskService.getAllTasks.mockResolvedValue(tasks);
      
      await TaskController.getAllTasks(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          count: 2,
          tasks: expect.any(Array)
        })
      );
    });
  });

  describe('getTaskById', () => {
    test('deve retornar tarefa por ID', async () => {
      const task = { id: 'task-123', title: 'Tarefa Teste' };
      mockReq.params.id = 'task-123';
      
      taskService.getTaskById.mockResolvedValue(task);
      
      await TaskController.getTaskById(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.any(Object)
        })
      );
    });

    test('deve retornar 404 para tarefa inexistente', async () => {
      mockReq.params.id = 'nonexistent';
      taskService.getTaskById.mockResolvedValue(null);
      
      await TaskController.getTaskById(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(404);
    });
  });

  describe('updateTask', () => {
    test('deve atualizar tarefa com sucesso', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = { title: 'Titulo Atualizado' };
      
      taskService.updateTask.mockResolvedValue({ id: 'task-123', title: 'Titulo Atualizado' });
      
      await TaskController.updateTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task updated successfully'
        })
      );
    });
  });

  describe('deleteTask', () => {
    test('deve deletar tarefa com sucesso', async () => {
      mockReq.params.id = 'task-123';
      
      taskService.deleteTask.mockResolvedValue({ id: 'task-123' });
      
      await TaskController.deleteTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task deleted successfully'
        })
      );
    });
  });

  describe('getNextTaskForUser', () => {
    test('deve retornar proxima tarefa para usuario', async () => {
      mockReq.params.nickname = 'testuser';
      const task = { id: 'task-123', title: 'Proxima Tarefa' };
      
      taskService.getNextTaskForUser.mockResolvedValue(task);
      
      await TaskController.getNextTaskForUser(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          task: expect.any(Object)
        })
      );
    });

    test('deve retornar null quando nenhuma tarefa pendente', async () => {
      mockReq.params.nickname = 'testuser';
      
      taskService.getNextTaskForUser.mockResolvedValue(null);
      
      await TaskController.getNextTaskForUser(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          task: null
        })
      );
    });
  });

  describe('updateTaskPosition', () => {
    test('deve atualizar posicao da tarefa', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = { position: 5 };
      
      taskService.updateTaskPosition.mockResolvedValue({ id: 'task-123', position: 5 });
      
      await TaskController.updateTaskPosition(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task position updated successfully'
        })
      );
    });

    test('deve rejeitar posicao nao numerica', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = { position: 'invalid' };
      
      await TaskController.updateTaskPosition(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('finalizeTask', () => {
    test('deve finalizar tarefa com sucesso usando userId', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = { userId: 'user-123', executionNotes: 'Concluido' };
      
      taskService.finalizeTask.mockResolvedValue({
        task: { id: 'task-123' },
        status: { name: 'Done' },
        isRecurringReset: false
      });
      
      await TaskController.finalizeTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task finalized successfully'
        })
      );
    });

    test('deve finalizar tarefa com sucesso usando nickname', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = { nickname: 'testuser', executionNotes: 'Concluido' };
      
      // Mock do prisma para retornar usuário pelo nickname
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-123',
        nickname: 'testuser'
      });
      
      taskService.finalizeTask.mockResolvedValue({
        task: { id: 'task-123' },
        status: { name: 'Done' },
        isRecurringReset: false
      });
      
      await TaskController.finalizeTask(mockReq, mockRes, mockNext);
      
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Task finalized successfully'
        })
      );
    });

    test('deve rejeitar sem userId ou nickname', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = {};
      
      // Mock do prisma para não encontrar usuário
      prisma.user.findUnique.mockResolvedValue(null);
      
      await TaskController.finalizeTask(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error.statusCode).toBe(400);
    });
  });
});
