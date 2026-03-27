const DeveloperLoopOrchestrator = require('../../src/steps/DeveloperLoopOrchestrator');

// --- 1. MOCKS COMPLETAMENTE REFORMULADOS ---
// Criamos funções de spy externas para podermos manipulá-las dentro de cada teste
const mockTurnExecute = jest.fn();
jest.mock('../../src/steps/DeveloperTurnStep', () => {
  return class DeveloperTurnStep {
    execute(context) { return mockTurnExecute(context); }
  };
});

const mockContractExecute = jest.fn();
jest.mock('../../src/steps/ContractVerificationStep', () => {
  return class ContractVerificationStep {
    execute(context) { return mockContractExecute(context); }
  };
});

const mockEcosystemExecute = jest.fn();
jest.mock('../../src/steps/EcosystemValidationStep', () => {
  return class EcosystemValidationStep {
    execute(context) { return mockEcosystemExecute(context); }
  };
});

const mockOpenClawService = {
  wipeAgentAmnesiaCache: jest.fn().mockResolvedValue()
};
jest.mock('../../src/services/openclawService', () => mockOpenClawService);

describe('DeveloperLoopOrchestrator', () => {
  let mockLog, mockSessionChainUtils, mockTaskExecService, mockEvidenceService, mockFs, mockPath;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Comportamento padrão dos steps (pode ser sobrescrito nos testes)
    mockTurnExecute.mockResolvedValue({
      turnResult: {
        success: true,
        feedbackForNextTurn: 'feedback do turno',
        openClawResult: { rawOutput: '{"tool": "exec"}' } // Saída limpa
      },
      evidence: {},
      actualDoneFilePath: '/fake/path.done'
    });

    mockContractExecute.mockResolvedValue({
      contractVerificationResult: {
        success: true,
        contractFulfilled: false,
        missingRequirements: ['Falta requisito X']
      }
    });

    mockEcosystemExecute.mockResolvedValue({
      ecosystemValidationResult: {
        success: true,
        passed: true
      }
    });

    mockLog = jest.fn().mockResolvedValue();
    
    mockSessionChainUtils = {
      getTaskChain: jest.fn().mockResolvedValue([]) 
    };

    mockTaskExecService = {
      verifyArchitectWork: jest.fn().mockResolvedValue(null), 
      readTaskOutputFile: jest.fn().mockResolvedValue('fake data')
    };

    mockEvidenceService = {
      computeTurnProgress: jest.fn().mockReturnValue({ hasMeaningfulProgress: true })
    };

    mockFs = {
      writeFile: jest.fn().mockResolvedValue()
    };

    mockPath = {};

    defaultContext = {
      task: { id: 'task-123', agent: 'main' },
      project: { pastaBase: '/fake/dir', agent: 'main' },
      files: { promptFile: '/fake/prompt.txt' },
      config: { TASKS_DIR: '/fake/tasks' },
      analysisPlan: {},
      currentInput: 'Faz a tela de login',
      architectAnalysis: '',
      architectPlan: 'Plano do arquiteto'
    };
  });

  const createOrchestrator = () => new DeveloperLoopOrchestrator({
    log: mockLog,
    sessionChainUtils: mockSessionChainUtils,
    taskExecutionService: mockTaskExecService,
    evidenceService: mockEvidenceService,
    fileSystem: mockFs,
    path: mockPath
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se o contexto estiver incompleto', async () => {
    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute({});
    
    expect(result.developerLoopResult.success).toBe(false);
    expect(result.developerLoopResult.error).toContain('contexto incompleto');
  });

  it('2. Deve pular o loop se o arquiteto já executou a tarefa (Skipped)', async () => {
    mockTaskExecService.verifyArchitectWork.mockResolvedValueOnce({
      success: true,
      contractResult: { contractFulfilled: true },
      finalResult: { notas: 'tudo pronto' }
    });

    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(result.developerLoopResult.success).toBe(true);
    expect(result.developerLoopResult.skipped).toBe(true);
    expect(result.contractResult.contractFulfilled).toBe(true);
  });

  it('3. Deve executar e concluir no primeiro turno se o contrato for cumprido e ecossistema passar', async () => {
    // Força o contrato a passar de primeira
    mockContractExecute.mockResolvedValueOnce({
      contractVerificationResult: { success: true, contractFulfilled: true }
    });

    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(result.developerLoopResult.success).toBe(true);
    expect(result.developerLoopResult.contractFulfilled).toBe(true);
    expect(result.developerLoopResult.turnsExecuted).toBe(1);
  });

  it('4. Deve abortar por ESTAGNAÇÃO PRINCIPAL se não houver progresso após N turnos', async () => {
    // Força o progresso a ser estagnado (false)
    mockEvidenceService.computeTurnProgress.mockReturnValue({ hasMeaningfulProgress: false });

    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(result.developerLoopResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.abortReason).toContain('Estagnação de IA detectada');
    expect(result.developerLoopResult.turnsExecuted).toBe(5); 
  });

  it('5. Deve continuar o loop mas incrementar estagnação se o ecossistema falhar', async () => {
    // Retorna uma PROMESSA FRESCA a cada chamada para evitar mutação de referência
    mockContractExecute.mockImplementation(() => Promise.resolve({
      contractVerificationResult: { success: true, contractFulfilled: true }
    }));
    
    mockEcosystemExecute.mockImplementation(() => Promise.resolve({
      ecosystemValidationResult: { success: true, passed: false },
      lastFeedback: 'Erro de Lint'
    }));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(result.developerLoopResult.success).toBe(false);
    expect(result.abortReason).toContain('Estagnação detectada no Ecossistema');
    expect(result.developerLoopResult.turnsExecuted).toBe(5);
  });
  

  it('6. Deve abortar se atingir maxTurns (15) sem cumprir contrato', async () => {
    // Progresso existe (então não cai na estagnação), mas contrato nunca termina
    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(result.developerLoopResult.success).toBe(false);
    expect(result.developerLoopResult.turnsExecuted).toBe(15);
    expect(result.abortReason).toContain('Limite de 15 turnos atingido');
  });

  it('7. Deve acionar o Desfibrilador se detectar lixo binário e limpar o cache', async () => {
    // Turno 1: Lixo binário. Turno 2: Código limpo.
    mockTurnExecute
      .mockResolvedValueOnce({
        turnResult: { success: true, openClawResult: { errorMessage: 'LIXO BINÁRIO' } }
      })
      .mockResolvedValueOnce({
        turnResult: { success: true, openClawResult: { rawOutput: 'limpo' } }
      });

    // O turno 1 pula a etapa de contrato por causa do desfibrilador. 
    // O primeiro chamado do contrato ocorrerá apenas no turno 2, onde simulamos o sucesso.
    mockContractExecute.mockResolvedValueOnce({ 
      contractVerificationResult: { success: true, contractFulfilled: true } 
    });

    const orchestrator = createOrchestrator();
    const result = await orchestrator.execute(defaultContext);

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('[PÂNICO] O Programador leu lixo binário'));
    expect(mockOpenClawService.wipeAgentAmnesiaCache).toHaveBeenCalledTimes(2); // 1 do setup, 1 do desfibrilador
    expect(result.developerLoopResult.success).toBe(true);
    expect(result.developerLoopResult.turnsExecuted).toBe(2);
  });
});