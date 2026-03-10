// test/taskController.test.js
// Testes unitarios para TaskController

const TaskController = require('../src/controllers/taskController');

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

const taskService = require('../src/services/taskService');

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
      user: { id: 'test-user-id' },
      correlationId: 'test-correlation-id'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
  });

  describe('createTask', () => {
    test('deve criar tarefa com sucesso', async () => {
      const taskData = {
        title: 'Nova Tarefa',
        description: 'Descricao da tarefa',
        projectId: 'proj-123',
        statusId: 'status-123',
        priorityId: 'priority-123',
        deadline: '2024-12-31'
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

    test('deve rejeitar sem autenticacao', async () => {
      mockReq.user = null;
      
      await TaskController.createTask(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
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
    test('deve finalizar tarefa com sucesso', async () => {
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

    test('deve rejeitar sem userId', async () => {
      mockReq.params.id = 'task-123';
      mockReq.body = {};
      
      await TaskController.finalizeTask(mockReq, mockRes, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
