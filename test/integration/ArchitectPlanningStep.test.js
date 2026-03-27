const ArchitectPlanningStep = require('../../src/steps/ArchitectPlanningStep'); // Ajuste o caminho

describe('ArchitectPlanningStep', () => {
  let mockLog, mockOpenClaw, mockSessionChain, mockSmartFinder, mockTaskAnalysis;
  let mockSnapshotService, mockFileUtils, mockFs, mockPromptFactory;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    
    mockOpenClaw = {
      executeWithFallback: jest.fn().mockResolvedValue({
        rawOutput: 'Saída padrão do terminal do arquiteto'
      })
    };

    mockSessionChain = {
      generateIsolatedSessionId: jest.fn().mockResolvedValue('session-arq-123')
    };

    mockSmartFinder = {
      findRealArchitectPlan: jest.fn().mockResolvedValue({
        content: 'Plano detalhado salvo no arquivo md'
      })
    };

    mockTaskAnalysis = {
      analyzeArchitectResponse: jest.fn().mockResolvedValue({
        hasExecuted: false,
        hasPlan: true,
        confidence: 90,
        analysisFailed: false
      })
    };

    mockSnapshotService = {
      takeSnapshot: jest.fn().mockResolvedValue(new Map()),
      compareSnapshots: jest.fn().mockReturnValue({ modified: [], created: [] })
    };

    mockFileUtils = {
      fileExists: jest.fn().mockResolvedValue(false) // Arquivos .done ou relatorio não existem por padrão
    };

    mockFs = {
      writeFile: jest.fn().mockResolvedValue()
    };

    mockPromptFactory = {}; // Injetado, mas não usado diretamente no execute()

    defaultContext = {
      task: { id: 'task-123', agent: 'main' },
      project: { pastaBase: '/fake/dir', agent: 'main' },
      files: { 
        architectLogFile: '/fake/arq.log',
        architectPlanFile: '/fake/arq-plan.md',
        doneFile: '/fake/.done',
        relatorioFile: '/fake/relatorio.md',
        promptFile: '/fake/prompt.txt'
      },
      initialSnapshot: new Map(),
      config: { TASKS_DIR: '/fake/tasks', TASK_TIMEOUT_MS: 600000 },
      analysisPlan: { taskType: 'feature' },
      developerPrompt: 'Instruções padrão do desenvolvedor',
      currentInput: 'Crie uma tela de login'
    };
  });

  const createStep = () => new ArchitectPlanningStep({
    log: mockLog,
    openClawService: mockOpenClaw,
    sessionChainUtils: mockSessionChain,
    smartFileFinder: mockSmartFinder,
    taskAnalysisService: mockTaskAnalysis,
    workspaceSnapshotService: mockSnapshotService,
    fileUtils: mockFileUtils,
    fileSystem: mockFs,
    promptFactory: mockPromptFactory
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se o contexto estiver incompleto', async () => {
    const step = createStep();
    const result = await step.execute({}); 
    
    expect(result.architectPlanningResult.success).toBe(false);
    expect(result.architectPlanningResult.error).toContain('contexto incompleto');
    expect(mockOpenClaw.executeWithFallback).not.toHaveBeenCalled();
  });

  it('2. Fluxo Normal: Arquiteto apenas planeja (Sem execução)', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.architectPlanningResult.success).toBe(true);
    expect(result.architectPlanningResult.hasArchitectPlan).toBe(true);
    expect(result.architectPlanningResult.hasArchitectExecution).toBe(false);
    
    // Deve juntar o plano do arquiteto com o prompt do desenvolvedor
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/fake/prompt.txt',
      expect.stringContaining('=== PLANO DE AÇÃO DO ARQUITETO ===')
    );
  });

  it('3. Fluxo Execução Real: Arquiteto executa a tarefa E as evidências confirmam', async () => {
    // IA diz que ele executou
    mockTaskAnalysis.analyzeArchitectResponse.mockResolvedValueOnce({
      hasExecuted: true,
      hasPlan: true,
      confidence: 85
    });

    // Detetive de arquivos confirma que houve arquivos alterados
    mockSnapshotService.compareSnapshots.mockReturnValueOnce({
      modified: ['src/app.js'],
      created: ['src/login.js']
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.architectPlanningResult.hasArchitectExecution).toBe(true);
    expect(mockFs.writeFile).toHaveBeenCalledWith(
      '/fake/prompt.txt',
      expect.stringContaining('=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===')
    );
  });

  it('4. O Detetive em Ação: Corrige a IA se ela alucinar que executou (Falta de Evidências)', async () => {
    // IA jura que executou a tarefa com 95% de certeza
    mockTaskAnalysis.analyzeArchitectResponse.mockResolvedValueOnce({
      hasExecuted: true,
      hasPlan: true,
      confidence: 95
    });

    // MAS o detetive não acha NADA (arquivos não existem, snapshot zerado)
    mockFileUtils.fileExists.mockResolvedValue(false);
    mockSnapshotService.compareSnapshots.mockReturnValueOnce({ modified: [], created: [] });

    const step = createStep();
    const result = await step.execute(defaultContext);

    // O sistema DEVE sobrescrever a IA e marcar hasExecuted como false
    expect(result.architectAnalysis.hasExecuted).toBe(false);
    expect(result.architectPlanningResult.hasArchitectExecution).toBe(false);
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('NENHUMA evidência encontrada! IA provavelmente errou'));
  });

  it('5. Fallback de Arquivo: Usa rawOutput se o arquivo de plano não for encontrado', async () => {
    // SmartFinder não acha o arquivo
    mockSmartFinder.findRealArchitectPlan.mockResolvedValueOnce({ content: null });
    
    // Mas o terminal (rawOutput) tem texto longo
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      rawOutput: 'Plano super longo gerado diretamente no terminal em vez de salvo no arquivo...'
    });

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.architectPlanningResult.success).toBe(true);
    expect(result.architectPlanningResult.hasArchitectPlan).toBe(true);
    expect(result.architectPlan).toBe('Plano super longo gerado diretamente no terminal em vez de salvo no arquivo...');
    
    // Deve tentar salvar o rawOutput no arquivo oficial para correção
    expect(mockFs.writeFile).toHaveBeenCalledWith('/fake/arq-plan.md', expect.any(String));
  });

  it('6. Plano Vazio ou Falha: Volta para a descrição original da tarefa', async () => {
    // Nem no arquivo, nem no terminal tem nada útil
    mockSmartFinder.findRealArchitectPlan.mockResolvedValueOnce({ content: null });
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({ rawOutput: 'ok' }); // Muito curto (< 50 chars)

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.architectAnalysis.analysisFailed).toBe(true);
    expect(result.architectPlanningResult.hasArchitectPlan).toBe(false);
    
    // Como falhou, o desenvolvedor recebe apenas as instruções dele, sem plano do arquiteto
    expect(mockFs.writeFile).toHaveBeenCalledWith('/fake/prompt.txt', 'Instruções padrão do desenvolvedor');
  });

  it('7. Deve capturar e logar exceções sistêmicas', async () => {
    // Força um erro no OpenClaw
    mockOpenClaw.executeWithFallback.mockRejectedValueOnce(new Error('API Timeout'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.architectPlanningResult.success).toBe(false);
    expect(result.architectPlanningResult.error).toBe('API Timeout');
    expect(result.shouldAbort).toBe(true);
  });
});