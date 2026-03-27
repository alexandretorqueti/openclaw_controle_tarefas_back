const DeveloperTurnStep = require('../../src/steps/DeveloperTurnStep'); // Ajuste o caminho

describe('DeveloperTurnStep', () => {
  let mockLog, mockOpenClaw, mockEvidence, mockFs, mockPath, mockTaskAnalysis, mockSessionChainUtils;
  let defaultContext;

  beforeEach(() => {
    // 1. Resetando Mocks
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    
    mockOpenClaw = {
      executeWithFallback: jest.fn().mockResolvedValue({
        rawOutput: '{"tool": "teste"}',
        toolCall: {},
        toolResult: {},
        toolFeedback: 'Ferramenta executada com sucesso'
      })
    };

    mockEvidence = {
      createEmptyEvidence: jest.fn().mockReturnValue({}),
      applyExecutionEvidence: jest.fn()
    };

    mockFs = {
      writeFile: jest.fn().mockResolvedValue(),
      readdir: jest.fn().mockRejectedValue(new Error('no dir')) // Padrão: não acha .done
    };

    mockPath = {
      join: jest.fn((...args) => args.join('/'))
    };

    mockTaskAnalysis = {
      analyzeDeveloperTurn: jest.fn().mockResolvedValue({
        isDeclaringDone: false,
        hasFulfilledContract: false,
        isTalkingWithoutAction: false,
        missingRequirements: []
      })
    };

    // NOVO: Mock do SessionChainUtils injetado
    mockSessionChainUtils = {
      generateLoopSessionId: jest.fn((id, type, ts) => `mock-session-${id}-${ts}`)
    };

    // 2. Contexto Base para os testes
    defaultContext = {
      task: { id: 'task-123', agent: 'main' },
      project: { pastaBase: '/fake/project/dir', agent: 'main' },
      files: { terminalLogFile: '/fake/terminal.log', doneFile: '/fake/task.done' },
      config: { TASKS_DIR: '/fake/tasks', TASK_TIMEOUT_MS: 5000 },
      turnNumber: 1,
      basePrompt: 'Crie um botão',
      executionTimestamp: 1600000000000
    };
  });

  // Atualizado para injetar o mockSessionChainUtils
  const createStep = () => new DeveloperTurnStep({
    log: mockLog,
    openClawService: mockOpenClaw,
    evidenceService: mockEvidence,
    fileSystem: mockFs,
    path: mockPath,
    taskAnalysisService: mockTaskAnalysis,
    sessionChainUtils: mockSessionChainUtils
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se o contexto estiver incompleto', async () => {
    const step = createStep();
    const result = await step.execute({});
    
    expect(result.turnResult.success).toBe(false);
    expect(result.turnResult.error).toBe('contexto incompleto');
    expect(mockOpenClaw.executeWithFallback).not.toHaveBeenCalled();
  });

  it('2. Deve executar fluxo normal no Turno 1 (usando basePrompt)', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.success).toBe(true);
    expect(result.turnResult.feedbackForNextTurn).toBe('Ferramenta executada com sucesso');
    
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/fake/tasks/developer-prompt-task-123-turn-1.txt',
      'Crie um botão'
    );
  });

  it('3. Deve concatenar lastFeedback no prompt se for Turno > 1', async () => {
    const step = createStep();
    const ctx = { ...defaultContext, turnNumber: 2, lastFeedback: 'Corrija o CSS' };
    await step.execute(ctx);

    const expectedPrompt = `\n\n=== RESULTADO DA SUA ÚLTIMA AÇÃO ===\nCorrija o CSS\n\nContinue a tarefa.`;
    
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/fake/tasks/developer-prompt-task-123-turn-2.txt',
      expectedPrompt
    );
  });

  it('4. Deve detectar e retornar erro de sintaxe (Truncamento de JSON)', async () => {
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      rawOutput: '{ "tool": "exec", "params": ' 
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.feedbackForNextTurn).toContain('[ERRO DE SINTAXE]');
    expect(result.turnResult.hasMeaningfulProgress).toBe(false);
  });

  it('5. Deve punir o agente se declarar conclusão sem cumprir requisitos', async () => {
    mockTaskAnalysis.analyzeDeveloperTurn.mockResolvedValueOnce({
      isDeclaringDone: true,
      hasFulfilledContract: false,
      missingRequirements: ['Falta validação']
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.feedbackForNextTurn).toContain('Você indicou que terminou');
    expect(result.turnResult.hasMeaningfulProgress).toBe(false);
  });

  it('6. Deve avisar o agente se ele apenas conversar sem chamar ferramentas', async () => {
    mockTaskAnalysis.analyzeDeveloperTurn.mockResolvedValueOnce({
      isTalkingWithoutAction: true
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.feedbackForNextTurn).toContain('Você explicou um plano, mas não executou');
    expect(result.turnResult.hasMeaningfulProgress).toBe(false);
  });

  it('7. Deve detectar arquivo .done criado dinamicamente', async () => {
    mockFs.readdir.mockImplementation(async (dir) => {
      if (dir === '/fake/tasks') return ['inesperado.done'];
      return [];
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.doneExists).toBe(true);
    expect(result.turnResult.actualDonePath).toBe('/fake/tasks/inesperado.done');
  });

  it('8. Deve capturar exceções não tratadas', async () => {
    mockOpenClaw.executeWithFallback.mockRejectedValueOnce(new Error('Crash'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.turnResult.success).toBe(false);
    expect(result.turnResult.error).toBe('Crash');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Erro no DeveloperTurnStep'));
  });

  it('9. Deve chamar o gerador de sessão e a IA com parâmetros corretos', async () => {
    const step = createStep();
    await step.execute(defaultContext);

    // Verifica se a util de sessão nova foi chamada corretamente
    expect(mockSessionChainUtils.generateLoopSessionId).toHaveBeenCalledWith(
      'task-123',
      'programador-main-loop',
      1600000000000
    );

    expect(mockOpenClaw.executeWithFallback).toHaveBeenCalledWith(
      'mock-session-task-123-1600000000000', 
      'Crie um botão',                       
      'main',                                
      'main',                                
      null,
      '/fake/tasks',                         
      '/fake/terminal.log',                  
      '/fake/project/dir',                   
      5000                                   
    );
  });
});