// test/unit/steps/AnalystStep.test.js

const container = require('../../../src/container');
const AnalystStep = require('../../../src/steps/AnalystStep');

// Importar factories de mocks
const { createOpenClawServiceMock } = require('../../mocks/openClawService.mock');
const { createPromptFactoryMock } = require('../../mocks/promptFactory.mock');
const { createSessionChainUtilsMock } = require('../../mocks/sessionChainUtils.mock');
const { createJsonUtilsMock } = require('../../mocks/jsonUtils.mock');
const { createTaskServiceMock } = require('../../mocks/taskService.mock');
const { createDecompositionServiceMock } = require('../../mocks/decompositionService.mock');
const { createCommentServiceMock } = require('../../mocks/commentService.mock');
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createFileSystemMock } = require('../../mocks/fileSystem.mock');

describe('AnalystStep', () => {
  let step;
  let mocks;
  
  // Dados de teste
  const mockTask = {
    id: 'task-123',
    title: 'Implementar sistema de autenticação',
    description: 'Criar login com JWT e refresh token',
    projectId: 'project-456',
    statusId: 'status-1',
    priorityId: 'priority-1',
    assignedToId: 'user-789',
    agent: 'main',
    project: {
      programadorBack: 'backend-agent',
      programadorFront: 'frontend-agent',
      pastaBase: '/home/project',
      modeloAuxiliar: 'gpt-4'
    }
  };
  
  const mockConfig = {
    TASKS_DIR: '/tmp/tasks',
    TASK_TIMEOUT_MS: 180000
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar todos os mocks
    mocks = {
      openClawService: createOpenClawServiceMock(),
      promptFactory: createPromptFactoryMock(),
      sessionChainUtils: createSessionChainUtilsMock(),
      jsonUtils: createJsonUtilsMock(),
      taskService: createTaskServiceMock(),
      decompositionService: createDecompositionServiceMock(),
      commentService: createCommentServiceMock(),
      log: createLoggerMock(),
      fileSystem: createFileSystemMock(),
      config: mockConfig
    };
    
    // Registrar mocks no container
    container.register('openClawService', mocks.openClawService);
    container.register('promptFactory', mocks.promptFactory);
    container.register('sessionChainUtils', mocks.sessionChainUtils);
    container.register('jsonUtils', mocks.jsonUtils);
    container.register('taskService', mocks.taskService);
    container.register('decompositionService', mocks.decompositionService);
    container.register('commentService', mocks.commentService);
    container.register('log', mocks.log);
    container.register('config', mocks.config);
    container.register('fileSystem', mocks.fileSystem);
    
    // Criar instância do step (agora usa o container)
    step = new AnalystStep();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida com decomposição', () => {
    it('deve decompor tarefa complexa em subtarefas', async () => {
      const context = { task: mockTask, userId: 'user-123' };
      
      const result = await step.execute(context);
      
      // Verificar chamadas aos serviços
      expect(mocks.sessionChainUtils.generateUnifiedSessionId).toHaveBeenCalledWith(
        'task-123',
        'arquiteto'
      );
      
      expect(mocks.promptFactory.buildDecompositionPrompt).toHaveBeenCalledWith(mockTask);
      
      expect(mocks.openClawService.executeWithFallback).toHaveBeenCalledWith(
        'mock-session-task-123-arquiteto',
        expect.stringContaining('Mock decomposition prompt'),
        'backend-agent',
        'frontend-agent',
        'gpt-4',
        '/tmp/tasks',
        '/tmp/tasks/architect-task-123.log',
        '/home/project',
        180000
      );
      
      // Verificar que decompositionService foi chamado
      expect(mocks.decompositionService.decompose).toHaveBeenCalledWith(
        'task-123',
        expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('[BACKEND]'),
            domain: 'BACKEND'
          }),
          expect.objectContaining({
            title: expect.stringContaining('[FRONTEND]'),
            domain: 'FRONTEND'
          })
        ])
      );
      
      // Verificar que taskService.updateTask NÃO foi chamado (não é atômica)
      expect(mocks.taskService.updateTask).not.toHaveBeenCalled();
      
      // Verificar resultado
      expect(result.analysisResult.success).toBe(true);
      expect(result.analysisResult.subtasksCreated).toBe(2);
      expect(result.analysisResult.subtasks).toHaveLength(2);
    });
    
    it('deve adicionar comentário sobre decomposição', async () => {
      const context = { task: mockTask, userId: 'user-123' };
      
      await step.execute(context);
      
      expect(mocks.commentService.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId: 'task-123',
          userId: 'user-123',
          content: expect.stringContaining('Análise Concluída pelo Arquiteto')
        })
      );
    });
  });
  
  describe('execução com tarefa atômica', () => {
    it('deve marcar tarefa como atômica quando OpenClaw retornar array vazio', async () => {
      // Configurar mock para retornar array vazio
      mocks.openClawService.executeWithFallback.mockResolvedValueOnce({
        success: true,
        rawOutput: '[]',
        errorMessage: null
      });
      
      const context = { task: mockTask, userId: 'user-123' };
      const result = await step.execute(context);
      
      // Deve chamar updateTask com isAtomic: true
      expect(mocks.taskService.updateTask).toHaveBeenCalledWith('task-123', {
        isAtomic: true
      });
      
      // Não deve chamar decompositionService
      expect(mocks.decompositionService.decompose).not.toHaveBeenCalled();
      
      // Resultado deve indicar sucesso sem subtarefas
      expect(result.analysisResult.success).toBe(true);
      expect(result.analysisResult.subtasksCreated).toBe(0);
      expect(result.analysisResult.isAtomic).toBe(true);
    });
    
    it('deve marcar como atômica quando array tiver apenas 1 elemento', async () => {
      mocks.openClawService.executeWithFallback.mockResolvedValueOnce({
        success: true,
        rawOutput: JSON.stringify([{
          title: "[BACKEND] Única tarefa",
          description: "Descrição",
          domain: "BACKEND"
        }]),
        errorMessage: null
      });
      
      const context = { task: mockTask, userId: 'user-123' };
      const result = await step.execute(context);
      
      expect(mocks.taskService.updateTask).toHaveBeenCalledWith('task-123', {
        isAtomic: true
      });
      expect(result.analysisResult.subtasksCreated).toBe(0);
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com falha do OpenClawService', async () => {
      mocks.openClawService.executeWithFallback.mockResolvedValueOnce({
        success: false,
        rawOutput: null,
        errorMessage: 'Timeout na execução'
      });
      
      const context = { task: mockTask, userId: 'user-123' };
      const result = await step.execute(context);
      
      expect(result.analysisResult.success).toBe(false);
      expect(result.analysisResult.error).toContain('Timeout na execução');
      expect(result.shouldAbort).toBe(true);
      expect(result.abortReason).toContain('Falha na análise');
      
      // Deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao chamar Arquiteto')
      );
      
      // Deve ter adicionado comentário de erro
      expect(mocks.commentService.createComment).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Erro na Análise')
        })
      );
    });
    
    it('deve lidar com exceção durante parsing JSON', async () => {
      // Mock para retornar output inválido
      mocks.openClawService.executeWithFallback.mockResolvedValueOnce({
        success: true,
        rawOutput: 'Não é JSON válido',
        errorMessage: null
      });
      
      // Mock do extractJsonObjects também falha
      mocks.jsonUtils.extractJsonObjects.mockImplementationOnce(() => {
        throw new Error('Falha ao extrair JSON');
      });
      
      const context = { task: mockTask, userId: 'user-123' };
      const result = await step.execute(context);
      
      expect(result.analysisResult.success).toBe(false);
      expect(result.analysisResult.error).toContain('Falha ao extrair o JSON');
    });
    
    it('deve lidar com erro no decompositionService', async () => {
      mocks.decompositionService.decompose.mockRejectedValueOnce(
        new Error('Falha no banco de dados')
      );
      
      const context = { task: mockTask, userId: 'user-123' };
      const result = await step.execute(context);
      
      expect(result.analysisResult.success).toBe(false);
      expect(result.analysisResult.error).toContain('Falha no banco de dados');
    });
  });
  
  describe('configurações alternativas', () => {
    it('deve usar agentes padrão quando não configurados no projeto', async () => {
      const taskSemProjeto = {
        ...mockTask,
        project: null
      };
      
      const context = { task: taskSemProjeto, userId: 'user-123' };
      await step.execute(context);
      
      // Deve usar 'main' como fallback
      expect(mocks.openClawService.executeWithFallback).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'main',  // primaryAgent fallback
        'main',  // fallbackAgent fallback
        null,    // modeloAuxiliar
        expect.anything(),
        expect.anything(),
        undefined, // pastaBase
        expect.anything()
      );
    });
    
    it('deve usar programadorBack como primaryAgent quando disponível', async () => {
      const taskComProgramador = {
        ...mockTask,
        project: {
          programadorBack: 'special-backend-agent',
          programadorFront: 'special-frontend-agent'
        }
      };
      
      const context = { task: taskComProgramador, userId: 'user-123' };
      await step.execute(context);
      
      expect(mocks.openClawService.executeWithFallback).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        'special-backend-agent',
        'special-frontend-agent',
        null,
        expect.anything(),
        expect.anything(),
        undefined,
        expect.anything()
      );
    });
  });
});