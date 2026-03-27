const SetupContextStep = require('../../src/steps/SetupContextStep');

describe('SetupContextStep', () => {
  let mocks;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    // Centralização de mocks para facilitar a manutenção
    mocks = {
      log: jest.fn().mockResolvedValue(),
      config: { TASKS_DIR: '/workspace/tasks' },
      fileSystem: { writeFile: jest.fn().mockResolvedValue() },
      path: { join: (...args) => args.join('/') },
      prisma: {
        project: {
          findUnique: jest.fn().mockResolvedValue({
            id: 'proj-1',
            name: 'Projeto de Teste',
            pastaBase: '/repo/teste',
            frontendPath: 'src/client',
            backendPath: 'src/server'
          })
        }
      },
      taskAnalysisService: {
        analyzeTaskScope: jest.fn().mockResolvedValue({ taskType: 'development' })
      },
      workspaceSnapshotService: {
        takeSnapshot: jest.fn().mockResolvedValue(new Map([
          ['src/client/App.js', {}],
          ['src/server/index.js', {}],
          ['shared/utils.js', {}],
          ['package.json', {}]
        ]))
      },
      promptFactory: {
        buildArchitectPrompt: jest.fn().mockReturnValue('Prompt do Arquiteto'),
        buildEngineRulesPrompt: jest.fn().mockReturnValue('Regras da Engine')
      },
      fileUtils: { fileExists: jest.fn().mockResolvedValue(true) },
      sessionChainUtils: {
        getTaskChain: jest.fn().mockResolvedValue([
          { id: 'task-prev', title: 'Tarefa Anterior', status: { isFinalState: true } },
          { id: 'task-1', title: 'Tarefa Atual', status: { isFinalState: false } },
          { id: 'task-next', title: 'Tarefa Futura', status: { isFinalState: false } }
        ])
      }
    };

    defaultContext = {
      task: { 
        id: 'task-1', 
        title: 'Criar componente X', 
        projectId: 'proj-1',
        domain: 'frontend',
        description: 'Descrição original',
        comments: [
          { content: 'Comentário 1', user: { name: 'Dev', nickname: 'dev1' }, createdAt: new Date() }
        ]
      },
      userId: 'user-123'
    };
  });

  const createStep = () => new SetupContextStep({
    ...mocks
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se a task for inválida ou sem ID', async () => {
    const step = createStep();
    const result = await step.execute({ task: {} });

    expect(result.setupResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('task inválida'));
  });

  it('2. Fluxo Frontend: Deve aplicar filtro de domínio cirúrgico', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.setupResult.success).toBe(true);
    expect(result.setupResult.taskType).toBe('development');
    
    // Verifica se o filtro de frontend funcionou (removendo src/server/index.js)
    // Lista original: client, server, shared, package.json
    // Esperado: client, shared, package.json (3 arquivos)
    expect(result.setupResult.fileListCount).toBe(3);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Tarefa FRONTEND: Lista reduzida'));
  });

  it('3. Fluxo Backend: Deve aplicar filtro de domínio corretamente', async () => {
    defaultContext.task.domain = 'backend';
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.setupResult.fileListCount).toBe(3);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Tarefa BACKEND: Lista reduzida'));
  });

  it('4. Roadmap Visual: Deve injetar o roadmap na descrição da tarefa', async () => {
    const step = createStep();
    await step.execute(defaultContext);

    // Verifica se a descrição da task foi alterada para incluir o roadmap
    expect(defaultContext.task.description).toContain('=== ROADMAP DA FUNCIONALIDADE (EPIC) ===');
    expect(defaultContext.task.description).toContain('[📍 VOCÊ ESTÁ AQUI]');
    expect(defaultContext.task.description).toContain('[✅ CONCLUÍDO]');
    expect(defaultContext.task.description).toContain('[⏳ PENDENTE]');
  });

  it('5. Comentários: Deve formatar e incluir a seção de comentários', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.commentsSection).toContain('=== COMENTÁRIOS DA TAREFA ===');
    expect(result.commentsSection).toContain('Dev (dev1): Comentário 1');
  });

  it('6. Persistência: Deve salvar os arquivos de prompt e logs físicos', async () => {
    const step = createStep();
    await step.execute(defaultContext);

    // Verifica se os 3 arquivos (prompt, backup e terminal) foram "tocados" ou escritos
    expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('prompt-task-1.txt'), 
      expect.any(String)
    );
    expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
      expect.stringContaining('terminal-task-1.log'), 
      ''
    );
  });

  it('7. Resiliência: Deve continuar mesmo se o Roadmap falhar', async () => {
    mocks.sessionChainUtils.getTaskChain.mockRejectedValueOnce(new Error('DB Timeout'));
    
    const step = createStep();
    const result = await step.execute(defaultContext);

    // O setup deve continuar mesmo sem o roadmap
    expect(result.setupResult.success).toBe(true);
    expect(mocks.log).toHaveBeenCalledWith(expect.stringContaining('Erro ao montar roadmap visual'));
  });

  it('8. Tratamento de Erro: Deve abortar se a análise de escopo falhar', async () => {
    mocks.taskAnalysisService.analyzeTaskScope.mockRejectedValueOnce(new Error('IA Offline'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.setupResult.success).toBe(false);
    expect(result.shouldAbort).toBe(true);
    expect(result.setupResult.error).toBe('IA Offline');
  });
});