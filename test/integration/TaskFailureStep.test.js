const TaskFailureStep = require('../../src/steps/TaskFailureStep');

describe('TaskFailureStep', () => {
  let mocks;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup de Mocks para todas as dependências complexas
    mocks = {
      log: jest.fn().mockResolvedValue(),
      config: { 
        API_URL: 'http://api.test',
        TASKS_DIR: '/workspace/tasks',
        ERROR_DIR: '/workspace/errors',
        LOCK_FILE: '/workspace/task.lock'
      },
      axios: {
        get: jest.fn().mockResolvedValue({ data: { users: [{ id: 'user-alex', nickname: 'alexandre' }] } }),
        post: jest.fn().mockResolvedValue({}),
        put: jest.fn().mockResolvedValue({})
      },
      path: { join: (...args) => args.join('/') },
      fileUtils: { fileExists: jest.fn().mockResolvedValue(true) },
      fileSystem: { readFile: jest.fn().mockResolvedValue('Conteúdo do log do terminal com erro 500...') },
      lockService: { releaseLock: jest.fn().mockResolvedValue() },
      stateService: { cleanupTask: jest.fn().mockResolvedValue() },
      taskFileService: { moveTaskFiles: jest.fn().mockResolvedValue() }
    };

    defaultContext = {
      task: { id: 'task-err-1', title: 'Tarefa com Erro' },
      error: new Error('Simulação de erro na IA'),
      userId: 'user-reporter'
    };
  });

  const createStep = () => new TaskFailureStep({
    ...mocks
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se task ou error não forem fornecidos no contexto', async () => {
    const step = createStep();
    const result = await step.execute({});

    expect(result.failureResult.success).toBe(false);
    expect(result.failureResult.error).toContain('não fornecidos');
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('⚠️ TaskFailureStep'));
  });

  it('2. Fluxo Completo: Deve executar todas as ações de limpeza e reatribuição com sucesso', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.failureResult.success).toBe(true);
    expect(result.failureResult.actionsTaken).toEqual(
      expect.arrayContaining(['logged', 'commented', 'reassigned', 'lockReleased', 'filesMoved', 'stateCleaned'])
    );

    // Verifica se tentou reatribuir para 'alexandre'
    expect(mocks.axios.put).toHaveBeenCalledWith(
      'http://api.test/api/tasks/task-err-1',
      { assignedToId: 'user-alex' }
    );

    // Verifica se moveu os arquivos para a pasta de erro
    expect(mocks.taskFileService.moveTaskFiles).toHaveBeenCalledWith(
      'task-err-1',
      '/workspace/tasks',
      '/workspace/errors'
    );
  });

  it('3. Resiliência: Deve continuar o tratamento mesmo se a postagem do comentário falhar', async () => {
    mocks.axios.post.mockRejectedValueOnce(new Error('API Offline'));
    
    const step = createStep();
    const result = await step.execute(defaultContext);

    // Mesmo com erro no comentário, as outras ações (lock, move, cleanup) devem ocorrer
    expect(result.failureResult.success).toBe(true);
    expect(mocks.lockService.releaseLock).toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Erro ao postar comentário de falha'));
  });

  it('4. Reatribuição: Deve logar aviso se o usuário "alexandre" não for encontrado', async () => {
    mocks.axios.get.mockResolvedValueOnce({ data: { users: [] } }); // Nenhum usuário retornado

    const step = createStep();
    await step.execute(defaultContext);

    expect(mocks.axios.put).not.toHaveBeenCalled();
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Usuário \'alexandre\' não encontrado'));
  });

  it('5. Fallback de Lock: Deve usar a rota legada se o releaseLock falhar', async () => {
    // Simula falha no serviço de lock local
    mocks.lockService.releaseLock.mockRejectedValueOnce(new Error('Lock file busy'));

    const step = createStep();
    await step.execute(defaultContext);

    // Deve tentar o fallback via API PUT
    expect(mocks.axios.put).toHaveBeenCalledWith(
      'http://api.test/api/tasks/task-err-1/finish-execution'
    );
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Usando fallback para finish-execution'));
  });

  it('6. Terminal Log: Deve lidar corretamente com a ausência do arquivo de log', async () => {
    mocks.fileUtils.fileExists.mockResolvedValueOnce(false);

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.failureResult.success).toBe(true);
    expect(mocks.fileSystem.readFile).not.toHaveBeenCalled();
    
    // O comentário deve ser postado sem a saída do terminal
    expect(mocks.axios.post).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        content: expect.not.stringContaining('Conteúdo do log')
      })
    );
  });

  it('7. Erro Crítico: Deve abortar se ocorrer falha inesperada no Step', async () => {
    // Força erro no serviço de limpeza de estado
    mocks.stateService.cleanupTask.mockRejectedValueOnce(new Error('Internal Server Crash'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.failureResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.failureResult.error).toBe('Internal Server Crash');
  });
});