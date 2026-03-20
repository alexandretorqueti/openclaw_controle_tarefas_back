// test/unit/steps/TaskTimeoutCheckStep.test.js

const container = require('../../../src/container');
const TaskTimeoutCheckStep = require('../../../src/steps/TaskTimeoutCheckStep');

// Importar factories de mocks
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createTimeUtilsMock } = require('../../mocks/timeUtils.mock');
const { createLockServiceMock } = require('../../mocks/lockService.mock');
const { createMonitorStateServiceMock } = require('../../mocks/monitorStateService.mock');
const { createTaskFileServiceMock } = require('../../mocks/taskFileService.mock');

describe('TaskTimeoutCheckStep', () => {
  let step;
  let mocks;
  
  const mockPid = 12345;
  const mockTaskId = 'task-888';
  const mockStartTime = Date.now() - 120000; // 2 minutos atrás
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar config fresh para cada teste
    const mockConfig = {
      TASKS_DIR: '/tmp/tasks',
      ERROR_DIR: '/tmp/errors',
      LOCK_FILE: '/tmp/lock.pid',
      TASK_TIMEOUT_MS: 30000 // 30 segundos
    };
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      timeUtils: createTimeUtilsMock(),
      config: mockConfig
    };
    
    // Criar instâncias mock dos serviços
    const MockLockService = createLockServiceMock();
    const MockMonitorStateService = createMonitorStateServiceMock();
    const MockTaskFileService = createTaskFileServiceMock();
    
    mocks.lockService = new MockLockService('/tmp/lock.pid');
    mocks.stateService = new MockMonitorStateService('/tmp/tasks');
    mocks.taskFileService = new MockTaskFileService();
    
    // Configurar stateService para retornar tarefa ativa
    mocks.stateService.getActiveTasks.mockResolvedValue({
      [mockTaskId]: {
        startTime: mockStartTime,
        taskId: mockTaskId,
        pid: mockPid
      }
    });
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('timeUtils', mocks.timeUtils);
    container.register('config', mocks.config);
    
    // Registrar classes no container (para uso normal)
    container.register('LockServiceClass', MockLockService);
    container.register('MonitorStateServiceClass', MockMonitorStateService);
    container.register('TaskFileServiceClass', MockTaskFileService);
    
    // Criar instância do step com instâncias mock injetadas
    step = new TaskTimeoutCheckStep({
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
    it('deve retornar "no_active_tasks" quando não há tarefas ativas', async () => {
      // Configurar stateService para retornar objeto vazio
      mocks.stateService.getActiveTasks.mockResolvedValue({});
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado sobre nenhuma tarefa ativa
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Nenhuma tarefa ativa')
      );
      
      // Resultado deve indicar sucesso sem ação
      expect(result.timeoutCheckResult.success).toBe(true);
      expect(result.timeoutCheckResult.action).toBe('no_active_tasks');
    });
    
    it('deve retornar "within_timeout" quando tarefa está dentro do limite', async () => {
      // Configurar tarefa iniciada há 10 segundos (dentro do timeout de 30s)
      const recentStartTime = Date.now() - 10000; // 10 segundos atrás
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: recentStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado que está dentro do tempo limite
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('dentro do tempo limite')
      );
      
      // Deve ter chamado timeUtils para formatar tempo
      expect(mocks.timeUtils.segundosToMinutos_Segundos).toHaveBeenCalled();
      
      // Resultado deve indicar tarefa dentro do timeout
      expect(result.timeoutCheckResult.success).toBe(true);
      expect(result.timeoutCheckResult.action).toBe('within_timeout');
      expect(result.timeoutCheckResult.taskId).toBe(mockTaskId);
      expect(result.timeoutCheckResult.remainingMs).toBeGreaterThan(0);
    });
    
    it('deve retornar "warning_only" quando excede timeout mas está na grace period', async () => {
      // Configurar tarefa iniciada há 40 segundos (excede timeout de 30s, mas ainda na grace de 60s)
      const exceededStartTime = Date.now() - 40000; // 40 segundos atrás
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: exceededStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado alerta
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('ALERTA')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Aguardando carência de 1 minuto')
      );
      
      // Resultado deve indicar warning
      expect(result.timeoutCheckResult.success).toBe(true);
      expect(result.timeoutCheckResult.action).toBe('warning_only');
      expect(result.timeoutCheckResult.taskId).toBe(mockTaskId);
      expect(result.timeoutCheckResult.remainingGraceMs).toBeGreaterThan(0);
    });
    
    it('deve matar processo e limpar quando excede limite crítico', async () => {
      // Configurar tarefa iniciada há 120 segundos (excede timeout + grace: 30s + 60s = 90s)
      const criticalStartTime = Date.now() - 120000; // 120 segundos atrás
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: criticalStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado ações de ceifador
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('CEIFADOR')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Encerrando processo')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Sistema recuperado')
      );
      
      // Deve ter matado processo e liberado lock
      expect(mocks.lockService.killAndRelease).toHaveBeenCalledWith(mockPid);
      
      // Deve ter movido arquivos para erro
      expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalledWith(
        mockTaskId,
        '/tmp/tasks',
        '/tmp/errors'
      );
      
      // Deve ter limpado estado
      expect(mocks.stateService.cleanupTask).toHaveBeenCalledWith(mockTaskId);
      
      // Resultado deve indicar ação completa
      expect(result.timeoutCheckResult.success).toBe(true);
      expect(result.timeoutCheckResult.action).toBe('killed_and_cleaned');
      expect(result.timeoutCheckResult.taskId).toBe(mockTaskId);
      expect(result.timeoutCheckResult.pid).toBe(mockPid);
      expect(result.timeoutCheckResult.exceededByMs).toBeGreaterThan(0);
      expect(result.timeoutCheckResult.actionsTaken).toEqual([
        'killed_process', 'released_lock', 'moved_files', 'cleaned_state'
      ]);
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando pid não for fornecido', async () => {
      const context = {
        // pid faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.timeoutCheckResult.success).toBe(false);
      expect(result.timeoutCheckResult.error).toContain('pid não fornecido');
    });
  });
  
  describe('configurações customizadas', () => {
    it('deve usar taskTimeoutMs do contexto quando fornecido', async () => {
      // Configurar tarefa iniciada há 40 segundos
      const exceededStartTime = Date.now() - 40000;
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: exceededStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const customTimeoutMs = 20000; // 20 segundos (tarefa de 40s excede)
      const context = {
        pid: mockPid,
        taskTimeoutMs: customTimeoutMs
      };
      
      const result = await step.execute(context);
      
      // Com timeout custom de 20s, tarefa de 40s já excedeu timeout + grace (20+60=80s)?
      // Não, 40s < 80s, então deve ser warning_only (excedeu timeout mas não grace)
      expect(result.timeoutCheckResult.action).toBe('warning_only');
    });
    
    it('deve usar taskTimeoutMs do config quando não fornecido no contexto', async () => {
      // Config do beforeEach tem TASK_TIMEOUT_MS: 30000
      const exceededStartTime = Date.now() - 40000; // 40s > 30s
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: exceededStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const context = {
        pid: mockPid
        // sem taskTimeoutMs, usa config
      };
      
      const result = await step.execute(context);
      
      // Deve usar timeout do config (30s)
      expect(result.timeoutCheckResult.action).toBe('warning_only');
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com erro ao obter tarefas ativas', async () => {
      mocks.stateService.getActiveTasks.mockRejectedValue(
        new Error('Erro no state service')
      );
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no TaskTimeoutCheckStep')
      );
      
      // Resultado deve indicar falha
      expect(result.timeoutCheckResult.success).toBe(false);
      expect(result.timeoutCheckResult.error).toContain('Erro no state service');
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve lidar com erro ao matar processo', async () => {
      // Configurar tarefa que excede limite crítico
      const criticalStartTime = Date.now() - 120000;
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: criticalStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      // Configurar erro no killAndRelease
      mocks.lockService.killAndRelease.mockRejectedValue(
        new Error('Falha ao matar processo')
      );
      
      const context = {
        pid: mockPid
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no TaskTimeoutCheckStep')
      );
      
      // Resultado deve indicar falha
      expect(result.timeoutCheckResult.success).toBe(false);
      expect(result.timeoutCheckResult.error).toContain('Falha ao matar processo');
    });
  });
  
  describe('método estático checkTimeout', () => {
    it('deve funcionar corretamente via método estático', async () => {
      // Configurar tarefa dentro do timeout
      const recentStartTime = Date.now() - 10000;
      mocks.stateService.getActiveTasks.mockResolvedValue({
        [mockTaskId]: {
          startTime: recentStartTime,
          taskId: mockTaskId,
          pid: mockPid
        }
      });
      
      const result = await TaskTimeoutCheckStep.checkTimeout(mockPid);
      
      // Deve retornar resultado
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });
    
    it('deve aceitar taskTimeoutMs customizado', async () => {
      const result = await TaskTimeoutCheckStep.checkTimeout(mockPid, 60000);
      
      expect(result).toBeDefined();
    });
  });
});