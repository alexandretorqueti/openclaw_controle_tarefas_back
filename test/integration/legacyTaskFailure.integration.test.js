// test/integration/legacyTaskFailure.integration.test.js
/**
 * Teste de integração que demonstra a compatibilidade do novo TaskFailureStep
 * com a função handleTaskFailure original usando container.
 */

const container = require('../../src/container');
const { createLegacyTaskFailure } = require('../../src/steps/adapters/legacyTaskFailure');

// Importar factories de mocks
const { createLoggerMock } = require('../mocks/logger.mock');
const { createAxiosMock } = require('../mocks/axios.mock');
const { createFileUtilsMock } = require('../mocks/fileUtils.mock');
const { createLockServiceMock } = require('../mocks/lockService.mock');
const { createMonitorStateServiceMock } = require('../mocks/monitorStateService.mock');
const { createTaskFileServiceMock } = require('../mocks/taskFileService.mock');
const { createFileSystemMock } = require('../mocks/fileSystem.mock');

describe('Integração: legacyTaskFailure', () => {
  let handleTaskFailure;
  let mocks;
  let defaultUserId;
  let defaultApiUrl;
  
  const mockTask = {
    id: 'task-999',
    title: 'Tarefa de integração que falhou',
    description: 'Descrição',
    assignedToId: 'user-1'
  };
  
  const mockError = new Error('Erro de integração');
  
  beforeEach(() => {
    // Limpar container
    container.clear();
    
    // Criar mocks
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock(),
      fileUtils: createFileUtilsMock(),
      fileSystem: createFileSystemMock(),
      LockServiceClass: createLockServiceMock(),
      MonitorStateServiceClass: createMonitorStateServiceMock(),
      TaskFileServiceClass: createTaskFileServiceMock()
    };
    
    defaultUserId = 'user-jarbas-123';
    defaultApiUrl = 'http://localhost:3000';
    
    const mockConfig = {
      API_URL: defaultApiUrl,
      TASKS_DIR: '/tmp/tasks',
      ERROR_DIR: '/tmp/errors',
      LOCK_FILE: '/tmp/lock.pid'
    };
    
    // Criar instâncias mock dos serviços
    const MockLockService = createLockServiceMock();
    const MockMonitorStateService = createMonitorStateServiceMock();
    const MockTaskFileService = createTaskFileServiceMock();
    
    mocks.lockServiceInstance = new MockLockService('/tmp/lock.pid');
    mocks.stateServiceInstance = new MockMonitorStateService('/tmp/tasks');
    mocks.taskFileServiceInstance = new MockTaskFileService();
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('axios', mocks.axios);
    container.register('fileUtils', mocks.fileUtils);
    container.register('fileSystem', mocks.fileSystem);
    container.register('config', mockConfig);
    container.register('path', require('path'));
    container.register('LockServiceClass', MockLockService);
    container.register('MonitorStateServiceClass', MockMonitorStateService);
    container.register('TaskFileServiceClass', MockTaskFileService);
    
    // Criar função handleTaskFailure usando o adapter
    handleTaskFailure = createLegacyTaskFailure(defaultUserId, defaultApiUrl);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  it('deve executar todas as ações de tratamento de falha', async () => {
    await handleTaskFailure(mockTask, mockError);
    
    // Verificar ações básicas foram executadas
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Falha na execução da tarefa task-999')
    );
    
    expect(mocks.axios.post).toHaveBeenCalledWith(
      `${defaultApiUrl}/api/comments`,
      expect.objectContaining({
        taskId: 'task-999',
        userId: defaultUserId
      })
    );
    
    expect(mocks.axios.get).toHaveBeenCalledWith(`${defaultApiUrl}/api/users`);
    // Não podemos verificar chamadas diretas porque o adapter cria novas instâncias
    // Mas podemos verificar que não houve erros
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Falha na execução da tarefa')
    );
  });
  
  it('deve lidar com erros silenciosamente (como a função original)', async () => {
    // Configurar erro fatal
    mocks.LockServiceClass.releaseLock.mockRejectedValueOnce(
      new Error('Erro grave no lock')
    );
    
    // A função não deve lançar exceção
    await expect(handleTaskFailure(mockTask, mockError)).resolves.not.toThrow();
    
    // Deve ter logado os erros
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Erro ao limpar estado de execução')
    );
  });
  
  it('deve manter a mesma assinatura da função original', () => {
    // A função deve aceitar dois parâmetros (task, error)
    expect(handleTaskFailure).toBeInstanceOf(Function);
    expect(handleTaskFailure.length).toBe(2);
    
    // Deve retornar uma Promise<void>
    const returnValue = handleTaskFailure(mockTask, mockError);
    expect(returnValue).toBeInstanceOf(Promise);
    
    // A Promise deve resolver sem valor (void)
    return returnValue.then(result => {
      expect(result).toBeUndefined();
    });
  });
  
  it('deve funcionar sem userId e apiUrl padrão', async () => {
    // Criar adapter sem parâmetros
    const handleTaskFailureSemDefaults = createLegacyTaskFailure();
    
    await handleTaskFailureSemDefaults(mockTask, mockError);
    
    // Deve ter usado valores do config
    expect(mocks.axios.post).not.toHaveBeenCalled(); // porque userId é null
    expect(mocks.axios.get).toHaveBeenCalledWith(`${defaultApiUrl}/api/users`);
  });
  
  describe('comportamento igual à função original', () => {
    it('não deve lançar exceções (apenas logar)', async () => {
      mocks.TaskFileServiceClass.moveTaskFiles.mockRejectedValue(
        new Error('Erro grave no filesystem')
      );
      
      // A função original não lança exceção, apenas loga
      await expect(handleTaskFailure(mockTask, mockError)).resolves.not.toThrow();
      
      // Mas deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no TaskFailureStep')
      );
    });
    
    it('deve tentar todas as ações mesmo com erros parciais', async () => {
      // Configurar múltiplos erros parciais
      mocks.axios.post.mockRejectedValueOnce(new Error('API comentários offline'));
      mocks.axios.get.mockRejectedValueOnce(new Error('API users offline'));
      mocks.LockServiceClass.releaseLock.mockRejectedValueOnce(new Error('Lock corrompido'));
      
      await handleTaskFailure(mockTask, mockError);
      
      // Ainda deve ter tentado mover arquivos e limpar estado
      expect(mocks.TaskFileServiceClass.moveTaskFiles).toHaveBeenCalled();
      expect(mocks.MonitorStateServiceClass.cleanupTask).toHaveBeenCalled();
      
      // Deve ter logado todos os erros
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao postar comentário de falha')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro de rede ao tentar reatribuir a tarefa')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao limpar estado de execução')
      );
    });
  });
});