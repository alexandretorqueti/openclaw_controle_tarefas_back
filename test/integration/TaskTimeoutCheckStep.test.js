const TaskTimeoutCheckStep = require('../../src/steps/TaskTimeoutCheckStep');

// --- MOCK DO CONTAINER PARA SUPORTE ESTÁTICO ---
jest.mock('../../src/container', () => ({
  resolve: jest.fn((name) => {
    if (name === 'log') return jest.fn().mockResolvedValue();
    if (name === 'config') return { TASK_TIMEOUT_MS: 300000, LOCK_FILE: '/tmp/t.lock', TASKS_DIR: '/tmp/tasks' };
    if (name === 'timeUtils') return { segundosToMinutos_Segundos: (s) => `${s}s` };
    if (name === 'LockServiceClass') return jest.fn().mockImplementation(() => ({ killAndRelease: jest.fn() }));
    if (name === 'MonitorStateServiceClass') return jest.fn().mockImplementation(() => ({ getActiveTasks: jest.fn(), cleanupTask: jest.fn() }));
    if (name === 'TaskFileServiceClass') return jest.fn().mockImplementation(() => ({ moveTaskFiles: jest.fn() }));
    return {};
  })
}));

describe('TaskTimeoutCheckStep', () => {
  let mocks;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mocks = {
      log: jest.fn().mockResolvedValue(),
      config: { 
        TASK_TIMEOUT_MS: 10000, // 10 segundos para o teste
        TASKS_DIR: '/workspace/tasks',
        ERROR_DIR: '/workspace/errors'
      },
      timeUtils: { segundosToMinutos_Segundos: jest.fn().mockReturnValue('10s') },
      lockService: { killAndRelease: jest.fn().mockResolvedValue() },
      stateService: { 
        getActiveTasks: jest.fn().mockResolvedValue({
          'task-1': { startTime: Date.now() - 5000 } // Rodando há 5s (dentro do timeout)
        }),
        cleanupTask: jest.fn().mockResolvedValue() 
      },
      taskFileService: { moveTaskFiles: jest.fn().mockResolvedValue() }
    };

    defaultContext = { pid: 1234, taskTimeoutMs: 10000 };
  });

  const createStep = () => new TaskTimeoutCheckStep(mocks);

  it('1. Deve abortar se pid não for fornecido', async () => {
    const step = createStep();
    const result = await step.execute({});
    expect(result.timeoutCheckResult.success).toBe(false);
    expect(result.timeoutCheckResult.error).toContain('pid não fornecido');
  });

  it('2. Deve lidar com ausência de tarefas ativas', async () => {
    mocks.stateService.getActiveTasks.mockResolvedValueOnce({});
    const step = createStep();
    const result = await step.execute(defaultContext);
    expect(result.timeoutCheckResult.action).toBe('no_active_tasks');
  });

  it('3. Dentro do Timeout: Deve apenas logar e retornar status OK', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.timeoutCheckResult.action).toBe('within_timeout');
    expect(mocks.lockService.killAndRelease).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('dentro do tempo limite'));
  });

  it('4. Período de Carência: Deve alertar mas não matar se exceder timeout mas não a carência', async () => {
    // Timeout 10s. Tarefa rodando há 15s (excedeu timeout, mas < 10s + 60s carência)
    mocks.stateService.getActiveTasks.mockResolvedValueOnce({
      'task-1': { startTime: Date.now() - 15000 }
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.timeoutCheckResult.action).toBe('warning_only');
    expect(mocks.lockService.killAndRelease).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Aguardando carência'));
  });

  it('5. CEIFADOR: Deve matar processo e limpar sistema se exceder carência', async () => {
    // Timeout 10s. Tarefa rodando há 80s (excedeu 10s + 60s carência)
    mocks.stateService.getActiveTasks.mockResolvedValueOnce({
      'task-1': { startTime: Date.now() - 80000 }
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.timeoutCheckResult.action).toBe('killed_and_cleaned');
    expect(mocks.lockService.killAndRelease).toHaveBeenCalledWith(1234);
    expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalledWith('task-1', '/workspace/tasks', '/workspace/errors');
    expect(mocks.stateService.cleanupTask).toHaveBeenCalledWith('task-1');
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('💀 CEIFADOR'));
  });

  it('6. Erro Crítico: Deve capturar falhas no serviço de estado', async () => {
    mocks.stateService.getActiveTasks.mockRejectedValueOnce(new Error('Process access denied'));
    
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.timeoutCheckResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.abortReason).toContain('Process access denied');
  });

  it('7. Caso Estático: Deve funcionar via método estático checkTimeout', async () => {
    const spy = jest.spyOn(TaskTimeoutCheckStep.prototype, 'execute').mockResolvedValue({
      timeoutCheckResult: { success: true }
    });

    const result = await TaskTimeoutCheckStep.checkTimeout(9999);

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});