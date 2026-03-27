const EcosystemValidationStep = require('../../src/steps/EcosystemValidationStep');

describe('EcosystemValidationStep', () => {
  let mockLog, mockTaskExecutionService, mockFileUtils, mockFileSystem;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    
    // Mock do serviço que executa build/testes reais
    mockTaskExecutionService = {
      ensureAndValidateEcosystem: jest.fn().mockResolvedValue({
        passed: true,
        message: 'Build e testes passaram com sucesso'
      })
    };

    mockFileUtils = {
      fileExists: jest.fn().mockResolvedValue(true)
    };

    mockFileSystem = {
      unlink: jest.fn().mockResolvedValue()
    };

    // Contexto padrão simulando um contrato já cumprido
    defaultContext = {
      task: { id: 'task-999', title: 'Feature Test' },
      project: { name: 'Projeto Alpha', pastaBase: '/workspace/projeto-alpha' },
      config: { TASKS_DIR: '/workspace/tasks' },
      analysisPlan: { taskType: 'feature' },
      contractResult: { contractFulfilled: true },
      actualDoneFilePath: '/workspace/projeto-alpha/.done'
    };
  });

  const createStep = () => new EcosystemValidationStep({
    log: mockLog,
    taskExecutionService: mockTaskExecutionService,
    fileUtils: mockFileUtils,
    fileSystem: mockFileSystem
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve pular a validação se o contrato ainda não foi cumprido', async () => {
    const step = createStep();
    const context = { 
      ...defaultContext, 
      contractResult: { contractFulfilled: false } 
    };

    const result = await step.execute(context);

    expect(result.ecosystemValidationResult.skipped).toBe(true);
    expect(result.ecosystemValidationResult.reason).toContain('Contract not fulfilled');
    expect(mockTaskExecutionService.ensureAndValidateEcosystem).not.toHaveBeenCalled();
  });

  it('2. Deve pular a validação se não houver informações de projeto/diretório', async () => {
    const step = createStep();
    const context = { ...defaultContext, project: null };

    const result = await step.execute(context);

    expect(result.ecosystemValidationResult.skipped).toBe(true);
    expect(mockTaskExecutionService.ensureAndValidateEcosystem).not.toHaveBeenCalled();
  });

  it('3. Deve pular a validação para tarefas do tipo análise ou automação', async () => {
    const step = createStep();
    const context = { 
      ...defaultContext, 
      analysisPlan: { taskType: 'analysis' } 
    };

    const result = await step.execute(context);

    expect(result.ecosystemValidationResult.skipped).toBe(true);
    expect(result.ecosystemValidationResult.reason).toContain('analysis');
    expect(mockTaskExecutionService.ensureAndValidateEcosystem).not.toHaveBeenCalled();
  });

  it('4. Fluxo de Sucesso: Deve validar o ecossistema quando tudo está correto', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.ecosystemValidationResult.success).toBe(true);
    expect(result.ecosystemValidationResult.passed).toBe(true);
    expect(mockTaskExecutionService.ensureAndValidateEcosystem).toHaveBeenCalledWith(
      defaultContext.task,
      defaultContext.project,
      defaultContext.config
    );
  });

  it('5. Fluxo de Falha: Deve remover o arquivo .done e preparar feedback se a validação falhar', async () => {
    // Simula falha no build/testes
    mockTaskExecutionService.ensureAndValidateEcosystem.mockResolvedValueOnce({
      passed: false,
      message: 'Erro de compilação no arquivo index.js'
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.ecosystemValidationResult.passed).toBe(false);
    
    // Verificações cruciais de segurança
    expect(mockFileSystem.unlink).toHaveBeenCalledWith(defaultContext.actualDoneFilePath);
    expect(result.lastFeedback).toContain('Validação de Ecossistema falhou');
    expect(result.lastFeedback).toContain('Erro de compilação');
    
    // O contrato deve ser "desmarcado" para o loop continuar
    expect(result.contractResult.contractFulfilled).toBe(false);
  });

  it('6. Deve lidar com erro ao tentar remover o arquivo .done', async () => {
    mockTaskExecutionService.ensureAndValidateEcosystem.mockResolvedValueOnce({ passed: false });
    mockFileSystem.unlink.mockRejectedValueOnce(new Error('Permission denied'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    // Mesmo com erro no unlink, o step deve terminar e logar o aviso
    expect(result.ecosystemValidationResult.passed).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Não foi possível remover .done'));
  });

  it('7. Deve capturar e gerenciar exceções críticas no processo de validação', async () => {
    mockTaskExecutionService.ensureAndValidateEcosystem.mockRejectedValueOnce(new Error('Serviço de Docker fora do ar'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.ecosystemValidationResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.abortReason).toContain('Falha na validação do ecossistema');
  });
});