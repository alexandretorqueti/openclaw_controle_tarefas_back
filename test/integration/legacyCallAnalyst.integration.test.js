// test/integration/legacyCallAnalyst.integration.test.js
/**
 * Teste de integração que demonstra a compatibilidade do novo AnalystStep
 * com a função callAnalyst original usando container.
 */

const container = require('../../src/container');
const { createLegacyCallAnalyst } = require('../../src/steps/adapters/legacyCallAnalyst');

// Mocks (usando factories já criadas)
const { createOpenClawServiceMock } = require('../mocks/openClawService.mock');
const { createPromptFactoryMock } = require('../mocks/promptFactory.mock');
const { createSessionChainUtilsMock } = require('../mocks/sessionChainUtils.mock');
const { createJsonUtilsMock } = require('../mocks/jsonUtils.mock');
const { createTaskServiceMock } = require('../mocks/taskService.mock');
const { createDecompositionServiceMock } = require('../mocks/decompositionService.mock');
const { createCommentServiceMock } = require('../mocks/commentService.mock');
const { createLoggerMock } = require('../mocks/logger.mock');
const { createFileSystemMock } = require('../mocks/fileSystem.mock');

describe('Integração: legacyCallAnalyst', () => {
  let callAnalyst;
  let mocks;
  let mockConfig;
  let mockUserId;
  
  const mockTask = {
    id: 'task-999',
    title: 'Teste de integração',
    description: 'Descrição da tarefa',
    projectId: 'project-1',
    statusId: 'status-1',
    priorityId: 'priority-1',
    assignedToId: 'user-1',
    agent: 'main',
    project: {
      programadorBack: 'backend-agent',
      programadorFront: 'frontend-agent',
      pastaBase: '/home/test',
      modeloAuxiliar: 'gpt-4'
    }
  };
  
  beforeEach(() => {
    // Limpar container
    container.clear();
    
    // Criar mocks
    mocks = {
      openClawService: createOpenClawServiceMock(),
      promptFactory: createPromptFactoryMock(),
      sessionChainUtils: createSessionChainUtilsMock(),
      jsonUtils: createJsonUtilsMock(),
      taskService: createTaskServiceMock(),
      decompositionService: createDecompositionServiceMock(),
      commentService: createCommentServiceMock(),
      log: createLoggerMock(),
      fileSystem: createFileSystemMock()
    };
    
    mockConfig = {
      TASKS_DIR: '/tmp/tasks-integration',
      TASK_TIMEOUT_MS: 180000
    };
    
    mockUserId = 'user-jarbas-123';
    
    // Configurar mock para retornar subtarefas (2 elementos para acionar a decomposição)
    mocks.openClawService.executeWithFallback.mockResolvedValue({
      success: true,
      rawOutput: JSON.stringify([
        {
          title: "[BACKEND] Test endpoint",
          description: "Create test endpoint",
          domain: "BACKEND"
        },
        {
          title: "[FRONTEND] Test frontend",
          description: "Create frontend component",
          domain: "FRONTEND"
        }
      ]),
      errorMessage: null
    });
    
    // Registrar mocks no container
    container.register('openClawService', mocks.openClawService);
    container.register('promptFactory', mocks.promptFactory);
    container.register('sessionChainUtils', mocks.sessionChainUtils);
    container.register('jsonUtils', mocks.jsonUtils);
    container.register('taskService', mocks.taskService);
    container.register('decompositionService', mocks.decompositionService);
    container.register('commentService', mocks.commentService);
    container.register('log', mocks.log);
    container.register('config', mockConfig);
    container.register('fileSystem', mocks.fileSystem);
    
    // Criar função callAnalyst usando o adapter (agora só precisa do userId)
    callAnalyst = createLegacyCallAnalyst(mockUserId);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  it('deve retornar formato compatível com sucesso', async () => {
    const result = await callAnalyst(mockTask);
    
    expect(result).toEqual({
      success: true,
      subtasksCreated: 2
    });
    
    // Verificar que os serviços foram chamados
    expect(mocks.openClawService.executeWithFallback).toHaveBeenCalled();
    expect(mocks.decompositionService.decompose).toHaveBeenCalled();
  });
  
  it('deve retornar formato compatível com erro', async () => {
    // Configurar falha
    mocks.openClawService.executeWithFallback.mockResolvedValue({
      success: false,
      rawOutput: null,
      errorMessage: 'Mock error'
    });
    
    const result = await callAnalyst(mockTask);
    
    expect(result).toEqual({
      success: false,
      error: expect.stringContaining('Mock error')
    });
  });
  
  it('deve lidar com tarefa atômica (array vazio)', async () => {
    mocks.openClawService.executeWithFallback.mockResolvedValue({
      success: true,
      rawOutput: '[]',
      errorMessage: null
    });
    
    const result = await callAnalyst(mockTask);
    
    expect(result).toEqual({
      success: true,
      subtasksCreated: 0
    });
    
    // Deve ter marcado como atômica
    expect(mocks.taskService.updateTask).toHaveBeenCalledWith(
      'task-999',
      { isAtomic: true }
    );
  });
  
  it('deve adicionar comentários com userId correto', async () => {
    await callAnalyst(mockTask);
    
    // Verificar que commentService foi chamado com userId correto
    expect(mocks.commentService.createComment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: mockUserId
      })
    );
  });
  
  it('deve manter a mesma assinatura da função original', () => {
    // A função deve aceitar um parâmetro (task)
    expect(callAnalyst).toBeInstanceOf(Function);
    expect(callAnalyst.length).toBe(1);
    
    // Deve retornar uma Promise
    const returnValue = callAnalyst(mockTask);
    expect(returnValue).toBeInstanceOf(Promise);
    
    // A Promise deve resolver para objeto com propriedades esperadas
    return returnValue.then(result => {
      expect(result).toEqual(
        expect.objectContaining({
          success: expect.any(Boolean)
        })
      );
    });
  });
  
  describe('comparação com implementação original', () => {
    // Este teste valida que o adapter se comporta como a função original
    // com base na documentação da callAnalyst
    it('deve retornar success:true com subtasksCreated quando decompõe', async () => {
      // Configurar para retornar 2 subtarefas
      mocks.openClawService.executeWithFallback.mockResolvedValue({
        success: true,
        rawOutput: JSON.stringify([
          { title: '[BACKEND] T1', description: 'D1', domain: 'BACKEND' },
          { title: '[FRONTEND] T2', description: 'D2', domain: 'FRONTEND' }
        ]),
        errorMessage: null
      });
      
      const result = await callAnalyst(mockTask);
      
      expect(result.success).toBe(true);
      expect(result.subtasksCreated).toBe(2);
      expect(result.error).toBeUndefined();
    });
    
    it('deve retornar success:false com error quando falha', async () => {
      mocks.openClawService.executeWithFallback.mockResolvedValue({
        success: false,
        rawOutput: null,
        errorMessage: 'Timeout'
      });
      
      const result = await callAnalyst(mockTask);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout');
      expect(result.subtasksCreated).toBeUndefined();
    });
  });
});