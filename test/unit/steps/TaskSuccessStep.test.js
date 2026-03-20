// test/unit/steps/TaskSuccessStep.test.js

const container = require('../../../src/container');
const TaskSuccessStep = require('../../../src/steps/TaskSuccessStep');

// Importar factories de mocks
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createAxiosMock } = require('../../mocks/axios.mock');
const { createLockServiceMock } = require('../../mocks/lockService.mock');
const { createMonitorStateServiceMock } = require('../../mocks/monitorStateService.mock');
const { createTaskFileServiceMock } = require('../../mocks/taskFileService.mock');

describe('TaskSuccessStep', () => {
  let step;
  let mocks;
  
  // Dados de teste
  const mockTask = {
    id: 'task-456',
    title: 'Tarefa executada com sucesso',
    description: 'Descrição da tarefa',
    assignedToId: 'user-789'
  };
  
  const mockExecutionResult = {
    executionNotes: 'Tarefa concluída com sucesso\nResultado: OK',
    duration: 120,
    exitCode: 0
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar config fresh para cada teste
    const mockConfig = {
      API_URL: 'http://localhost:3000',
      TASKS_DIR: '/tmp/tasks',
      PROCESSED_DIR: '/tmp/processed',
      LOCK_FILE: '/tmp/lock.pid',
      MY_USER_ID: 'user-jarbas'
    };
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock(),
      config: mockConfig
    };
    
    // Criar instâncias mock dos serviços
    const MockLockService = createLockServiceMock();
    const MockMonitorStateService = createMonitorStateServiceMock();
    const MockTaskFileService = createTaskFileServiceMock();
    
    mocks.lockService = new MockLockService('/tmp/lock.pid');
    mocks.stateService = new MockMonitorStateService('/tmp/tasks');
    mocks.taskFileService = new MockTaskFileService();
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('axios', mocks.axios);
    container.register('config', mocks.config);
    
    // Registrar classes no container (para uso normal)
    container.register('LockServiceClass', MockLockService);
    container.register('MonitorStateServiceClass', MockMonitorStateService);
    container.register('TaskFileServiceClass', MockTaskFileService);
    
    // Criar instância do step com instâncias mock injetadas
    step = new TaskSuccessStep({
      lockService: mocks.lockService,
      stateService: mocks.stateService,
      taskFileService: mocks.taskFileService
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve tratar sucesso completo com todas as ações', async () => {
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult
      };
      
      const result = await step.execute(context);
      
      // 1. Deve ter logado o sucesso
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Tarefa task-456 executada com sucesso!')
      );
      
      // 2. Deve ter finalizado na API (com userId do config)
      expect(mocks.axios.patch).toHaveBeenCalledWith(
        'http://localhost:3000/api/tasks/task-456/finalize',
        expect.objectContaining({
          userId: 'user-jarbas',
          executionNotes: mockExecutionResult.executionNotes
        })
      );
      
      // 3. Deve ter movido arquivos
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalledWith(
        'task-456',
        '/tmp/tasks',
        '/tmp/processed'
      );
      
      // 4. Deve ter limpado estado
      expect(mocks.stateService.cleanupTask).toHaveBeenCalledWith('task-456');
      
      // 5. Deve ter liberado lock
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      
      // 6. Resultado deve indicar sucesso
      expect(result.successResult.success).toBe(true);
      expect(result.successResult.taskId).toBe('task-456');
      expect(result.successResult.actionsTaken).toEqual(expect.arrayContaining([
        'logged', 'apiFinalized', 'filesMoved', 'stateCleaned', 'lockReleased'
      ]));
    });
    
    it('deve funcionar com userId do contexto (sobrescreve config)', async () => {
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult,
        userId: 'user-custom'
      };
      
      await step.execute(context);
      
      // Deve usar userId do contexto, não do config
      expect(mocks.axios.patch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          userId: 'user-custom'
        })
      );
    });
    
    it('deve funcionar sem userId (não finaliza na API)', async () => {
      // Config sem MY_USER_ID
      mocks.config.MY_USER_ID = null;
      
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult
      };
      
      const result = await step.execute(context);
      
      // Não deve ter chamado API
      expect(mocks.axios.patch).not.toHaveBeenCalled();
      
      // Mas deve ter logado sobre a falta de userId
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Não foi possível finalizar tarefa na API')
      );
      
      // Ainda deve ter feito outras ações
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalled();
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      
      // actionsTaken deve incluir apiSkipped
      expect(result.successResult.actionsTaken).toContain('apiSkipped');
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando task não for fornecida', async () => {
      const context = {
        executionResult: mockExecutionResult
        // task faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.successResult.success).toBe(false);
      expect(result.successResult.error).toContain('task ou executionResult não fornecidos');
    });
    
    it('deve falhar quando executionResult não for fornecido', async () => {
      const context = {
        task: mockTask
        // executionResult faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.successResult.success).toBe(false);
      expect(result.successResult.error).toContain('task ou executionResult não fornecidos');
    });
  });
  
  describe('tratamento de erros parciais', () => {
    it('deve continuar mesmo se API falhar', async () => {
      // Configurar falha na API
      mocks.axios.patch.mockRejectedValueOnce(new Error('API offline'));
      
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado o erro da API
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao finalizar a tarefa na API')
      );
      
      // Mas ainda deve ter feito as outras ações
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalled();
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      
      // Resultado ainda deve ser sucesso (erro parcial é esperado)
      expect(result.successResult.success).toBe(true);
    });
    
    it('deve continuar mesmo se releaseLock falhar', async () => {
      // Configurar falha no releaseLock
      mocks.lockService.releaseLock.mockRejectedValueOnce(new Error('Lock corrupto'));
      
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado o erro do lock
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao liberar lock')
      );
      
      // Mas ainda deve ter feito outras ações
      expect(mocks.axios.patch).toHaveBeenCalled();
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalled();
      
      expect(result.successResult.success).toBe(true);
    });
    
    it('deve lidar com erro geral no step', async () => {
      // Configurar erro fatal no moveTaskFiles
      mocks.taskFileService.moveTaskFiles.mockRejectedValueOnce(
        new Error('Erro fatal no filesystem')
      );
      
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado erro fatal
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no TaskSuccessStep')
      );
      
      // Resultado deve indicar falha
      expect(result.successResult.success).toBe(false);
      expect(result.successResult.error).toContain('Erro fatal no filesystem');
      expect(result.shouldAbort).toBe(true);
    });
  });
  
  describe('método estático handleSuccess', () => {
    it('deve funcionar corretamente via método estático', async () => {
      // Para o método estático, não injetamos instâncias
      // Ele criará suas próprias a partir do container
      const result = await TaskSuccessStep.handleSuccess(
        mockTask, 
        mockExecutionResult, 
        'user-jarbas'
      );
      
      // Como não injetamos, não podemos verificar chamadas específicas
      // Mas podemos verificar que não lançou erro
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
  });
  
  describe('configurações customizadas', () => {
    it('deve usar apiUrl do contexto quando fornecido', async () => {
      const context = {
        task: mockTask,
        executionResult: mockExecutionResult,
        apiUrl: 'https://api.custom.com'
      };
      
      await step.execute(context);
      
      // Deve usar a URL customizada, não a do config
      expect(mocks.axios.patch).toHaveBeenCalledWith(
        'https://api.custom.com/api/tasks/task-456/finalize',
        expect.anything()
      );
    });
  });
});