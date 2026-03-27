const TeardownStep = require('../../src/steps/TeardownStep');

// --- MOCK DO CONTAINER PARA SUPORTE ESTÁTICO ---
jest.mock('../../src/container', () => ({
  resolve: jest.fn((name) => {
    if (name === 'log') return jest.fn().mockResolvedValue();
    if (name === 'path') return { join: (...args) => args.join('/'), basename: (p) => p.split('/').pop() };
    if (name === 'fileSystem') return { readFile: jest.fn() };
    if (name === 'fileUtils') return { fileExists: jest.fn() };
    if (name === 'taskExecutionService') return { finishExecutionLog: jest.fn() };
    if (name === 'taskService') return { updateTask: jest.fn() };
    return {};
  })
}));

describe('TeardownStep', () => {
  let mocks;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mocks = {
      log: jest.fn().mockResolvedValue(),
      path: { join: (...args) => args.join('/'), basename: (p) => p.split('/').pop() },
      fileSystem: { readFile: jest.fn().mockResolvedValue('Conteúdo do arquivo...') },
      fileUtils: { fileExists: jest.fn().mockResolvedValue(true) },
      taskExecutionService: { finishExecutionLog: jest.fn().mockResolvedValue() },
      taskService: { updateTask: jest.fn().mockResolvedValue() }
    };

    defaultContext = {
      task: { id: 'task-123' },
      executionLogData: { 
        id: 'log-456', 
        taskId: 'task-123', 
        startedAt: new Date(Date.now() - 5000) 
      },
      files: {
        promptFile: '/tasks/prompt-123.txt',
        architectPlanFile: '/tasks/plan-123.txt',
        architectLogFile: '/tasks/arq-log-123.log',
        terminalLogFile: '/tasks/term-123.log',
        relatorioFile: '/tasks/rep-123.txt'
      },
      config: { TASKS_DIR: '/tasks' },
      contractResult: { contractFulfilled: true, executionNotes: 'Perfeito' },
      architectPlan: 'Plano em memória'
    };
  });

  const createStep = () => new TeardownStep(mocks);

  it('1. Deve consolidar sucesso quando contractFulfilled é true', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.finalResult.success).toBe(true);
    expect(mocks.taskExecutionService.finishExecutionLog).toHaveBeenCalledWith(
      'log-456',
      expect.objectContaining({ success: true, durationMs: expect.any(Number) })
    );
  });

  it('2. Deve ler todos os arquivos e atualizar a tarefa no banco', async () => {
    const step = createStep();
    await step.execute(defaultContext);

    // Deve ter tentado ler os 5 arquivos principais
    expect(mocks.fileSystem.readFile).toHaveBeenCalledTimes(5);
    
    // Deve ter atualizado a tarefa com os conteúdos lidos
    expect(mocks.taskService.updateTask).toHaveBeenCalledWith(
      'task-123',
      expect.objectContaining({
        arquitetosPromptContent: 'Conteúdo do arquivo...',
        programadorReportContent: 'Conteúdo do arquivo...'
      })
    );
  });

  it('3. Deve lidar com ausência de contractResult com segurança', async () => {
    const step = createStep();
    const contextIncompleto = { ...defaultContext, contractResult: null };
    
    const result = await step.execute(contextIncompleto);

    expect(result.finalResult.success).toBe(false);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('contractResult é undefined'));
  });

  it('4. Deve ser resiliente se alguns arquivos não existirem', async () => {
    // Simula que apenas o relatório existe
    mocks.fileUtils.fileExists.mockImplementation((path) => Promise.resolve(path.includes('rep-123.txt')));

    const step = createStep();
    await step.execute(defaultContext);

    expect(mocks.taskService.updateTask).toHaveBeenCalledWith(
      'task-123',
      expect.objectContaining({ programadorReportContent: expect.any(String) })
    );
    // Não deve tentar incluir campos que não existiam no disco
    expect(mocks.taskService.updateTask).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ arquitetosPromptContent: expect.anything() })
    );
  });

  it('5. Deve capturar e logar exceções sistêmicas sem quebrar o pipeline', async () => {
    // Força um erro no serviço de logs do banco
    mocks.taskExecutionService.finishExecutionLog.mockRejectedValueOnce(new Error('DB Timeout'));
    
    const step = createStep();
    const result = await step.execute(defaultContext);

    // O teardown deve falhar o sucesso local, mas capturar o erro
    expect(result.finalResult.success).toBe(false);
    expect(result.finalResult.executionNotes).toContain('Falha no teardown');
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('💥 Erro no TeardownStep'));
  });

  it('6. Caso Estático: Deve funcionar via método estático finalizeTask', async () => {
    const spy = jest.spyOn(TeardownStep.prototype, 'execute').mockResolvedValue({
      finalResult: { success: true }
    });

    const result = await TeardownStep.finalizeTask(defaultContext);

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});