const GetNextTaskStep = require('../../src/steps/GetNextTaskStep');

describe('GetNextTaskStep', () => {
  let mockLog, mockAxios, mockConfig;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    
    mockConfig = {
      API_URL: 'https://api.meusistema.com'
    };

    // Mock do Axios para simular chamadas HTTP
    mockAxios = {
      get: jest.fn()
    };

    defaultContext = {
      nickname: 'dev-jarbas',
      apiUrl: null // Deve usar o valor do config por padrão
    };
  });

  const createStep = () => new GetNextTaskStep({
    log: mockLog,
    config: mockConfig,
    axios: mockAxios
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se o nickname não for fornecido no contexto', async () => {
    const step = createStep();
    const result = await step.execute({}); // Contexto sem nickname

    expect(result.nextTaskResult.success).toBe(false);
    expect(result.nextTaskResult.error).toContain('nickname não fornecido');
    expect(mockAxios.get).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('nickname não fornecido'));
  });

  it('2. Fluxo de Sucesso: Deve retornar a tarefa quando a API encontra algo', async () => {
    const taskData = { id: 'task-001', title: 'Refatorar Login' };
    mockAxios.get.mockResolvedValueOnce({
      data: { task: taskData }
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.nextTaskResult.success).toBe(true);
    expect(result.nextTaskResult.found).toBe(true);
    expect(result.task).toEqual(taskData); // Verifica se a tarefa foi injetada no contexto raiz
    expect(mockAxios.get).toHaveBeenCalledWith('https://api.meusistema.com/api/users/nickname/dev-jarbas/next-task');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Tarefa task-001 encontrada'));
  });

  it('3. Fila Vazia (200 OK): Deve lidar com API retornando sucesso mas sem tarefa', async () => {
    mockAxios.get.mockResolvedValueOnce({
      data: { task: null }
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.nextTaskResult.success).toBe(true);
    expect(result.nextTaskResult.found).toBe(false);
    expect(result.nextTaskResult.message).toBe('Nenhuma tarefa encontrada');
    expect(result.task).toBeUndefined();
  });

  it('4. Fila Vazia (404/204): Deve tratar como comportamento esperado e não erro', async () => {
    // Simula um erro de "Not Found" vindo do Axios
    mockAxios.get.mockRejectedValueOnce({
      response: { status: 404 }
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.nextTaskResult.success).toBe(true); // Sucesso técnico (comportamento esperado)
    expect(result.nextTaskResult.found).toBe(false);
    expect(result.nextTaskResult.message).toContain('Fila vazia');
    expect(mockLog).not.toHaveBeenCalledWith(expect.stringContaining('❌ Erro')); // Não deve logar erro
  });

  it('5. Erro de Rede/Servidor: Deve abortar o pipeline se a API falhar (Ex: 500)', async () => {
    mockAxios.get.mockRejectedValueOnce(new Error('Internal Server Error'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.nextTaskResult.success).toBe(false);
    expect(result.nextTaskResult.found).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.abortReason).toContain('Falha ao buscar próxima tarefa');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('❌ Erro ao buscar tarefa'));
  });

  it('6. Customização: Deve respeitar a apiUrl passada via contexto', async () => {
    mockAxios.get.mockResolvedValueOnce({ data: { task: null } });

    const step = createStep();
    await step.execute({ nickname: 'bob', apiUrl: 'https://staging-api.com' });

    expect(mockAxios.get).toHaveBeenCalledWith('https://staging-api.com/api/users/nickname/bob/next-task');
  });
});