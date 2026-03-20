// test/integration/legacyTaskSuccess.integration.test.js
/**
 * Teste de integração que demonstra a compatibilidade do novo TaskSuccessStep
 * com a função handleTaskSuccess original usando container.
 */

const container = require('../../src/container');
const { createLegacyTaskSuccess } = require('../../src/steps/adapters/legacyTaskSuccess');

// Importar factories de mocks
const { createLoggerMock } = require('../mocks/logger.mock');
const { createAxiosMock } = require('../mocks/axios.mock');
const { createLockServiceMock } = require('../mocks/lockService.mock');
const { createMonitorStateServiceMock } = require('../mocks/monitorStateService.mock');
const { createTaskFileServiceMock } = require('../mocks/taskFileService.mock');

describe('Integração: legacyTaskSuccess', () => {
  let handleTaskSuccess;
  let mocks;
  let defaultUserId;
  let defaultApiUrl;
  
  const mockTask = {
    id: 'task-777',
    title: 'Tarefa de integração executada',
    description: 'Descrição',
    assignedToId: 'user-1'
  };
  
  const mockExecutionResult = {
    executionNotes: 'Execução de integração bem-sucedida',
    duration: 150,
    exitCode: 0
  };
  
  beforeEach(() => {
    // Limpar container
    container.clear();
    
    // Criar mocks
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock()
    };
    
    defaultUserId = 'user-jarbas-123';
    defaultApiUrl = 'http://localhost:3000';
    
    const mockConfig = {
      API_URL: defaultApiUrl,
      TASKS_DIR: '/tmp/tasks',
      PROCESSED_DIR: '/tmp/processed',
      LOCK_FILE: '/tmp/lock.pid',
      MY_USER_ID: defaultUserId
    };
    
    // Criar instâncias mock dos serviços
    const MockLockService = createLockServiceMock();
    const MockMonitorStateService = createMonitorStateServiceMock();
    const MockTaskFileService = createTaskFileServiceMock();
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('axios', mocks.axios);
    container.register('config', mockConfig);
    
    // Registrar classes no container (para uso normal)
    container.register('LockServiceClass', MockLockService);
    container.register('MonitorStateServiceClass', MockMonitorStateService);
    container.register('TaskFileServiceClass', MockTaskFileService);
    
    // Criar função handleTaskSuccess usando o adapter
    handleTaskSuccess = createLegacyTaskSuccess(defaultUserId, defaultApiUrl);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  it('deve executar todas as ações de tratamento de sucesso', async () => {
    await handleTaskSuccess(mockTask, mockExecutionResult);
    
    // Verificar ações básicas foram executadas
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Tarefa task-777 executada com sucesso!')
    );
    
    expect(mocks.axios.patch).toHaveBeenCalledWith(
      `${defaultApiUrl}/api/tasks/task-777/finalize`,
      expect.objectContaining({
        userId: defaultUserId,
        executionNotes: mockExecutionResult.executionNotes
      })
    );
  });
  
  it('deve lidar com erros silenciosamente (como a função original)', async () => {
    // Configurar erro na API
    mocks.axios.patch.mockRejectedValueOnce(new Error('API offline'));
    
    // A função não deve lançar exceção
    await expect(handleTaskSuccess(mockTask, mockExecutionResult)).resolves.not.toThrow();
    
    // Deve ter logado o erro
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Erro ao finalizar a tarefa na API')
    );
  });
  
  it('deve manter a mesma assinatura da função original', () => {
    // A função deve aceitar dois parâmetros (task, executionResult)
    expect(handleTaskSuccess).toBeInstanceOf(Function);
    expect(handleTaskSuccess.length).toBe(2);
    
    // Deve retornar uma Promise<void>
    const returnValue = handleTaskSuccess(mockTask, mockExecutionResult);
    expect(returnValue).toBeInstanceOf(Promise);
    
    // A Promise deve resolver sem valor (void)
    return returnValue.then(result => {
      expect(result).toBeUndefined();
    });
  });
  
  it('deve funcionar sem userId e apiUrl padrão', async () => {
    // Criar adapter sem parâmetros
    const handleTaskSuccessSemDefaults = createLegacyTaskSuccess();
    
    await handleTaskSuccessSemDefaults(mockTask, mockExecutionResult);
    
    // Deve ter usado valores do config
    expect(mocks.axios.patch).toHaveBeenCalledWith(
      `${defaultApiUrl}/api/tasks/task-777/finalize`,
      expect.objectContaining({
        userId: defaultUserId
      })
    );
  });
  
  describe('comportamento igual à função original', () => {
    it('não deve lançar exceções (apenas logar)', async () => {
      mocks.axios.patch.mockRejectedValue(
        new Error('Erro grave na API')
      );
      
      // A função original não lança exceção, apenas loga
      await expect(handleTaskSuccess(mockTask, mockExecutionResult)).resolves.not.toThrow();
      
      // Mas deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao finalizar a tarefa na API')
      );
    });
    
    it('deve tentar todas as ações mesmo com erros parciais', async () => {
      // Configurar múltiplos erros parciais
      mocks.axios.patch.mockRejectedValueOnce(new Error('API finalize offline'));
      
      await handleTaskSuccess(mockTask, mockExecutionResult);
      
      // Deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao finalizar a tarefa na API')
      );
      
      // Ainda deve ter logado sucesso inicial
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Tarefa task-777 executada com sucesso!')
      );
    });
  });
});