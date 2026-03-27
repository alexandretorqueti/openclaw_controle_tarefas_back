const TaskSuccessStep = require('../../src/steps/TaskSuccessStep');

// --- MOCK DO CONTAINER ---
// Precisamos de um mock completo para o container para suportar a instanciação via método estático
jest.mock('../../src/container', () => ({
  resolve: jest.fn((name) => {
    // Mocks para o construtor
    if (name === 'log') return jest.fn().mockResolvedValue();
    if (name === 'config') return { 
      API_URL: 'http://api.test',
      LOCK_FILE: '/tmp/test.lock',
      TASKS_DIR: '/tmp/tasks'
    };
    if (name === 'axios') return { patch: jest.fn().mockResolvedValue({}) };
    
    // Classes para os métodos privados de factory
    if (name === 'LockServiceClass') return jest.fn().mockImplementation(() => ({ releaseLock: jest.fn() }));
    if (name === 'MonitorStateServiceClass') return jest.fn().mockImplementation(() => ({ cleanupTask: jest.fn() }));
    if (name === 'TaskFileServiceClass') return jest.fn().mockImplementation(() => ({ moveTaskFiles: jest.fn() }));
    
    return {};
  })
}));

describe('TaskSuccessStep', () => {
  let mocks;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup de Mocks para dependências injetadas manualmente via options
    mocks = {
      log: jest.fn().mockResolvedValue(),
      config: { 
        API_URL: 'http://api.test',
        MY_USER_ID: 'user-default-123',
        TASKS_DIR: '/workspace/tasks',
        PROCESSED_DIR: '/workspace/processed'
      },
      axios: {
        patch: jest.fn().mockResolvedValue({})
      },
      lockService: { releaseLock: jest.fn().mockResolvedValue() },
      stateService: { cleanupTask: jest.fn().mockResolvedValue() },
      taskFileService: { moveTaskFiles: jest.fn().mockResolvedValue() }
    };

    defaultContext = {
      task: { id: 'task-ok-1', title: 'Tarefa Concluída' },
      executionResult: { executionNotes: 'Tudo foi implementado conforme o plano.' },
      userId: 'user-dev-01'
    };
  });

  const createStep = () => new TaskSuccessStep({
    ...mocks
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se task ou executionResult não forem fornecidos', async () => {
    const step = createStep();
    const result = await step.execute({});

    expect(result.successResult.success).toBe(false);
    expect(result.successResult.error).toContain('não fornecidos');
  });

  it('2. Fluxo Normal: Deve finalizar na API, mover arquivos e liberar lock', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.successResult.success).toBe(true);
    expect(result.successResult.actionsTaken).toEqual(
      expect.arrayContaining(['logged', 'apiFinalized', 'filesMoved', 'stateCleaned', 'lockReleased'])
    );

    expect(mocks.axios.patch).toHaveBeenCalledWith(
      'http://api.test/api/tasks/task-ok-1/finalize',
      expect.objectContaining({
        userId: 'user-dev-01',
        executionNotes: 'Tudo foi implementado conforme o plano.'
      })
    );
  });

  it('3. Sem Usuário: Deve pular a finalização na API se userId for nulo', async () => {
    const step = createStep();
    const contextSemUser = { ...defaultContext, userId: null };
    mocks.config.MY_USER_ID = null;

    const result = await step.execute(contextSemUser);

    expect(result.successResult.success).toBe(true);
    expect(result.successResult.actionsTaken).toContain('apiSkipped');
  });

  it('4. Resiliência API: Deve continuar o fluxo mesmo se a API de finalização falhar', async () => {
    mocks.axios.patch.mockRejectedValueOnce(new Error('API Timeout'));
    
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.successResult.success).toBe(true);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Erro ao finalizar a tarefa na API'));
  });

  it('5. Resiliência Lock: Deve continuar mesmo se a liberação do lock falhar', async () => {
    mocks.lockService.releaseLock.mockRejectedValueOnce(new Error('Lock busy'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.successResult.success).toBe(true);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Erro ao liberar lock'));
  });

  it('6. Erro Crítico: Deve abortar se o serviço de arquivos falhar', async () => {
    mocks.taskFileService.moveTaskFiles.mockRejectedValueOnce(new Error('Disk Full'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.successResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
  });

  it('7. Caso Estático: Deve funcionar via método estático handleSuccess', async () => {
    // Agora o spy funcionará porque o construtor terá os valores do mock do container no topo
    const spy = jest.spyOn(TaskSuccessStep.prototype, 'execute').mockResolvedValue({
      successResult: { success: true }
    });

    const result = await TaskSuccessStep.handleSuccess(
      defaultContext.task, 
      defaultContext.executionResult, 
      'user-static'
    );

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});