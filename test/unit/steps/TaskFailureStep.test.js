// test/unit/steps/TaskFailureStep.test.js

const container = require('../../../src/container');
const TaskFailureStep = require('../../../src/steps/TaskFailureStep');

// Importar factories de mocks
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createAxiosMock } = require('../../mocks/axios.mock');
const { createFileUtilsMock } = require('../../mocks/fileUtils.mock');
const { createLockServiceMock } = require('../../mocks/lockService.mock');
const { createMonitorStateServiceMock } = require('../../mocks/monitorStateService.mock');
const { createTaskFileServiceMock } = require('../../mocks/taskFileService.mock');
const { createFileSystemMock } = require('../../mocks/fileSystem.mock');

describe('TaskFailureStep', () => {
  let step;
  let mocks;
  
  // Dados de teste
  const mockTask = {
    id: 'task-123',
    title: 'Tarefa que falhou',
    description: 'Descrição da tarefa',
    assignedToId: 'user-789'
  };
  
  const mockError = new Error('Timeout na execução');
  
  const mockConfig = {
    API_URL: 'http://localhost:3000',
    TASKS_DIR: '/tmp/tasks',
    ERROR_DIR: '/tmp/errors',
    LOCK_FILE: '/tmp/lock.pid'
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock(),
      fileUtils: createFileUtilsMock(),
      fileSystem: createFileSystemMock(),
      config: mockConfig,
      path: require('path')
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
    container.register('fileUtils', mocks.fileUtils);
    container.register('fileSystem', mocks.fileSystem);
    container.register('config', mocks.config);
    container.register('path', mocks.path);
    
    // Registrar classes no container (para uso normal)
    container.register('LockServiceClass', MockLockService);
    container.register('MonitorStateServiceClass', MockMonitorStateService);
    container.register('TaskFileServiceClass', MockTaskFileService);
    
    // Criar instância do step com instâncias mock injetadas
    step = new TaskFailureStep({
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
    it('deve tratar falha completa com todas as ações', async () => {
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      const result = await step.execute(context);
      
      // 1. Deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Falha na execução da tarefa task-123')
      );
      
      // 2. Deve ter verificado se log do terminal existe
      expect(mocks.fileUtils.fileExists).toHaveBeenCalledWith(
        '/tmp/tasks/terminal-task-123.log'
      );
      
      // 3. Deve ter adicionado comentário via API (com userId)
      expect(mocks.axios.post).toHaveBeenCalledWith(
        'http://localhost:3000/api/comments',
        expect.objectContaining({
          taskId: 'task-123',
          userId: 'user-jarbas',
          content: expect.stringContaining('FALHA DE EXECUÇÃO LOCAL')
        })
      );
      
      // 4. Deve ter tentado reatribuir tarefa
      expect(mocks.axios.get).toHaveBeenCalledWith(
        'http://localhost:3000/api/users'
      );
      
      // 5. Deve ter liberado lock
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      
      // 6. Deve ter movido arquivos
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalledWith(
        'task-123',
        '/tmp/tasks',
        '/tmp/errors'
      );
      
      // 7. Deve ter limpado estado
      expect(mocks.stateService.cleanupTask).toHaveBeenCalledWith('task-123');
      
      // 8. Resultado deve indicar sucesso
      expect(result.failureResult.success).toBe(true);
      expect(result.failureResult.taskId).toBe('task-123');
      expect(result.failureResult.actionsTaken).toEqual(expect.arrayContaining([
        'logged', 'commented', 'reassigned', 'lockReleased', 'filesMoved', 'stateCleaned'
      ]));
    });
    
    it('deve ler log do terminal quando arquivo existir', async () => {
      // Configurar mock para retornar que arquivo existe
      mocks.fileUtils.fileExists.mockResolvedValueOnce(true);
      mocks.fileSystem.readFile.mockResolvedValueOnce('Log do terminal\nlinha1\nlinha2');
      
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      await step.execute(context);
      
      // Deve ter lido o arquivo
      expect(mocks.fileSystem.readFile).toHaveBeenCalledWith(
        '/tmp/tasks/terminal-task-123.log',
        'utf8'
      );
      
      // O comentário deve conter o log
      expect(mocks.axios.post).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          content: expect.stringContaining('Log do terminal')
        })
      );
    });
    
    it('deve funcionar sem userId (não adiciona comentário)', async () => {
      const context = {
        task: mockTask,
        error: mockError
        // sem userId
      };
      
      await step.execute(context);
      
      // Não deve ter chamado axios.post para comentário
      expect(mocks.axios.post).not.toHaveBeenCalledWith(
        expect.stringContaining('/api/comments'),
        expect.anything()
      );
      
      // Mas ainda deve ter feito as outras ações
      expect(mocks.axios.get).toHaveBeenCalled(); // reatribuição
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando task não for fornecida', async () => {
      const context = {
        error: mockError
        // task faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.failureResult.success).toBe(false);
      expect(result.failureResult.error).toContain('task ou error não fornecidos');
    });
    
    it('deve falhar quando error não for fornecido', async () => {
      const context = {
        task: mockTask
        // error faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.failureResult.success).toBe(false);
      expect(result.failureResult.error).toContain('task ou error não fornecidos');
    });
  });
  
  describe('tratamento de erros parciais', () => {
    it('deve continuar mesmo se comentário falhar', async () => {
      // Configurar falha no comentário
      mocks.axios.post.mockRejectedValueOnce(new Error('API offline'));
      
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado o erro do comentário
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao postar comentário de falha')
      );
      
      // Mas ainda deve ter feito as outras ações
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalled();
      
      // Resultado ainda deve ser sucesso (erro parcial é esperado)
      expect(result.failureResult.success).toBe(true);
    });
    
    it('deve continuar mesmo se reatribuição falhar', async () => {
      // Configurar falha na reatribuição
      mocks.axios.get.mockRejectedValueOnce(new Error('Network error'));
      
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro de rede ao tentar reatribuir a tarefa')
      );
      
      // Mas ainda deve ter liberado lock
      expect(mocks.lockService.releaseLock).toHaveBeenCalled();
      expect(result.failureResult.success).toBe(true);
    });
    
    it('deve usar fallback se releaseLock falhar', async () => {
      // Configurar falha no releaseLock
      mocks.lockService.releaseLock.mockRejectedValueOnce(new Error('Lock corrupto'));
      
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      await step.execute(context);
      
      // Deve ter tentado fallback (finish-execution)
      expect(mocks.axios.put).toHaveBeenCalledWith(
        'http://localhost:3000/api/tasks/task-123/finish-execution'
      );
      
      // Deve ter logado sobre o fallback
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Usando fallback para finish-execution')
      );
    });
    
    it('deve lidar com erro geral no step', async () => {
      // Configurar erro fatal no moveTaskFiles
      mocks.taskFileService.moveTaskFiles.mockRejectedValueOnce(
        new Error('Erro fatal no filesystem')
      );
      
      const context = {
        task: mockTask,
        error: mockError,
        userId: 'user-jarbas'
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado erro fatal
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no TaskFailureStep')
      );
      
      // Resultado deve indicar falha
      expect(result.failureResult.success).toBe(false);
      expect(result.failureResult.error).toContain('Erro fatal no filesystem');
      expect(result.shouldAbort).toBe(true);
    });
  });
  
  describe('método estático handleFailure', () => {
    it('deve funcionar corretamente via método estático', async () => {
      // Para o método estático, não injetamos instâncias
      // Ele criará suas próprias a partir do container
      const result = await TaskFailureStep.handleFailure(mockTask, mockError, 'user-jarbas');
      
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
        error: mockError,
        userId: 'user-jarbas',
        apiUrl: 'https://api.custom.com'
      };
      
      await step.execute(context);
      
      // Deve usar a URL customizada, não a do config
      expect(mocks.axios.post).toHaveBeenCalledWith(
        'https://api.custom.com/api/comments',
        expect.anything()
      );
      
      expect(mocks.axios.get).toHaveBeenCalledWith(
        'https://api.custom.com/api/users'
      );
    });
  });
});