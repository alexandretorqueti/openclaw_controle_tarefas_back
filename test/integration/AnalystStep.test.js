const AnalystStep = require('../../src/steps/AnalystStep');

describe('AnalystStep', () => {
  let mockOpenClaw, mockPromptFactory, mockSessionChain, mockJsonUtils;
  let mockTaskService, mockDecompositionService, mockCommentService, mockLog;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    mockCommentService = { createComment: jest.fn().mockResolvedValue() };
    mockTaskService = { updateTask: jest.fn().mockResolvedValue() };
    mockDecompositionService = { decompose: jest.fn().mockResolvedValue({ id: 'dec-123' }) };
    
    mockOpenClaw = {
      executeWithFallback: jest.fn().mockResolvedValue({
        success: true,
        rawOutput: `[{"title": "Sub 1", "description": "Desc 1"}, {"title": "Sub 2", "description": "Desc 2"}]`
      })
    };

    mockPromptFactory = { buildDecompositionPrompt: jest.fn().mockReturnValue('Prompt gerado') };
    mockSessionChain = { generateIsolatedSessionId: jest.fn().mockResolvedValue('session-123') };
    mockJsonUtils = { extractJsonObjects: jest.fn() };

    defaultContext = {
      userId: 'user-001',
      task: { 
        id: 'task-1', 
        title: 'Criar Login',
        projectId: 'proj-1',
        statusId: 'status-todo',
        priorityId: 'prio-high',
        assignedToId: 'user-001',
        agent: 'main',
        project: { agent: 'main', pastaBase: '/fake/dir' }
      }
    };
  });

  const createStep = () => new AnalystStep({
    openClawService: mockOpenClaw,
    promptFactory: mockPromptFactory,
    sessionChainUtils: mockSessionChain,
    jsonUtils: mockJsonUtils,
    taskService: mockTaskService,
    decompositionService: mockDecompositionService,
    commentService: mockCommentService,
    log: mockLog,
    config: { TASKS_DIR: '/fake/tasks', TASK_TIMEOUT_MS: 5000 },
    fileSystem: {},
    path: { join: (...args) => args.join('/') }
  });

  it('1. Deve abortar se a tarefa não for fornecida no contexto', async () => {
    const step = createStep();
    const result = await step.execute({});
    expect(result.analysisResult.success).toBe(false);
  });

  it('2. Fluxo Normal: Deve decompor a tarefa em múltiplas subtarefas', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);
    expect(result.analysisResult.success).toBe(true);
    expect(result.analysisResult.subtasksCreated).toBe(2);
  });

  it('3. Tarefa Atômica: Se o agente retornar 1 ou 0 subtarefas, marca como atômica', async () => {
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      success: true,
      rawOutput: `[{"title": "Unica tarefa"}]`
    });
    const step = createStep();
    const result = await step.execute(defaultContext);
    expect(result.analysisResult.isAtomic).toBe(true);
  });

  it('4. Edge Case JSON: Deve lidar com array aninhado [ [ {..} ] ]', async () => {
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      success: true,
      rawOutput: `[[{"title": "Sub 1"}, {"title": "Sub 2"}]]`
    });
    const step = createStep();
    const result = await step.execute(defaultContext);
    expect(result.analysisResult.subtasksCreated).toBe(2);
  });

  it('5. Fallback JSON: Deve usar jsonUtils se o JSON.parse nativo falhar por causa de texto markdown', async () => {
    // Usando Template Literals (crases) para evitar erros de escrita e lidar com as quebras de linha
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      success: true,
      rawOutput: `Aqui está o plano:
\`\`\`json
[{"title": "Sub 1"}]
\`\`\``
    });
    
    mockJsonUtils.extractJsonObjects.mockReturnValueOnce([{"title": "Sub 1", "description": "OK"}]);

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.analysisResult.isAtomic).toBe(true);
    expect(mockJsonUtils.extractJsonObjects).toHaveBeenCalled();
  });

  it('6. Tratamento de Erro: Deve abortar se OpenClaw falhar', async () => {
    mockOpenClaw.executeWithFallback.mockResolvedValueOnce({
      success: false,
      errorMessage: 'Token limit reached'
    });
    const step = createStep();
    const result = await step.execute(defaultContext);
    expect(result.analysisResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
  });
});