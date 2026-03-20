// test/unit/steps/ArchitectPlanningStep.test.js

const container = require('../../../src/container');
const ArchitectPlanningStep = require('../../../src/steps/ArchitectPlanningStep');

// Importar factories de mocks
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createOpenClawServiceMock } = require('../../mocks/openClawService.mock');
const { createSessionChainUtilsMock } = require('../../mocks/sessionChainUtils.mock');
const { createSmartFileFinderMock } = require('../../mocks/smartFileFinder.mock');
const { createTaskAnalysisServiceMock } = require('../../mocks/taskAnalysisService.mock');
const { createWorkspaceSnapshotServiceMock } = require('../../mocks/workspaceSnapshotService.mock');
const { createFileUtilsMock } = require('../../mocks/fileUtils.mock');
const { createPromptFactoryMock } = require('../../mocks/promptFactory.mock');

describe('ArchitectPlanningStep', () => {
  let step;
  let mocks;
  
  const mockTask = {
    id: 'task-architect-123',
    title: 'Tarefa para arquiteto',
    description: 'Descrição',
    agent: 'main'
  };
  
  const mockProject = {
    id: 'project-456',
    name: 'Projeto Teste',
    pastaBase: '/tmp/project',
    agent: 'main'
  };
  
  const mockFiles = {
    promptFile: '/tmp/tasks/prompt-task-architect-123.txt',
    relatorioFile: '/tmp/tasks/relatorio-task-architect-123.txt',
    doneFile: '/tmp/tasks/done-task-architect-123.done',
    terminalLogFile: '/tmp/tasks/terminal-task-architect-123.log',
    architectPlanFile: '/tmp/tasks/plano-arquiteto-task-architect-123.txt',
    architectLogFile: '/tmp/tasks/terminal-arquiteto-task-architect-123.log'
  };
  
  const mockConfig = {
    TASKS_DIR: '/tmp/tasks',
    TASK_TIMEOUT_MS: 60000
  };
  
  const mockInitialSnapshot = new Map([
    ['/tmp/project/file1.js', 1234567890],
    ['/tmp/project/file2.js', 1234567890]
  ]);
  
  const mockAnalysisPlan = {
    taskType: 'development',
    scope: 'Moderate',
    mandatoryChecks: ['Verificar execução'],
    finalizationInstructions: ['Criar .done']
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      fileSystem: {
        writeFile: jest.fn().mockResolvedValue(undefined)
      }
    };
    
    // Criar mocks dos serviços
    mocks.openClawService = createOpenClawServiceMock();
    mocks.sessionChainUtils = createSessionChainUtilsMock();
    mocks.smartFileFinder = createSmartFileFinderMock();
    mocks.taskAnalysisService = createTaskAnalysisServiceMock();
    mocks.workspaceSnapshotService = createWorkspaceSnapshotServiceMock();
    mocks.fileUtils = createFileUtilsMock();
    mocks.promptFactory = createPromptFactoryMock();
    
    // Configurar mocks específicos
    mocks.sessionChainUtils.generateUnifiedSessionId.mockResolvedValue('session-arquiteto-123');
    
    mocks.openClawService.executeWithFallback.mockResolvedValue({
      rawOutput: 'Resposta raw do arquiteto',
      success: true
    });
    
    mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
      content: 'Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.',
      path: mockFiles.architectPlanFile
    });
    
    mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
      hasExecuted: false,
      hasPlan: true,
      confidence: 85,
      executionDetails: null,
      planDetails: 'Plano detalhado gerado',
      analysisFailed: false
    });
    
    mocks.fileUtils.fileExists.mockResolvedValue(false); // doneFile não existe por padrão
    
    mocks.promptFactory.buildArchitectPrompt.mockReturnValue('Prompt do arquiteto gerado');
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('fileSystem', mocks.fileSystem);
    container.register('openClawService', mocks.openClawService);
    container.register('sessionChainUtils', mocks.sessionChainUtils);
    container.register('smartFileFinder', mocks.smartFileFinder);
    container.register('taskAnalysisService', mocks.taskAnalysisService);
    container.register('workspaceSnapshotService', mocks.workspaceSnapshotService);
    container.register('fileUtils', mocks.fileUtils);
    container.register('promptFactory', mocks.promptFactory);
    
    // Criar instância do step
    step = new ArchitectPlanningStep();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve executar planejamento do arquiteto com plano gerado', async () => {
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: 'Comentários',
        developerPrompt: 'Prompt do desenvolvedor',
        currentInput: 'Prompt original'
      };
      
      const result = await step.execute(context);
      
      // 1. Deve ter logado tipo de tarefa
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Tipo de tarefa: development')
      );
      
      // 2. Deve ter gerado prompt do arquiteto
      expect(mocks.promptFactory.buildArchitectPrompt).toHaveBeenCalledWith(
        mockTask,
        mockProject,
        expect.any(Array),
        mockFiles.architectPlanFile,
        'Comentários',
        'development'
      );
      
      // 3. Deve ter gerado sessão unificada
      expect(mocks.sessionChainUtils.generateUnifiedSessionId).toHaveBeenCalledWith(
        mockTask.id,
        'arquiteto'
      );
      
      // 4. Deve ter executado OpenClaw
      expect(mocks.openClawService.executeWithFallback).toHaveBeenCalledWith(
        'session-arquiteto-123',
        'Prompt do arquiteto gerado',
        'main',
        'main',
        null,
        '/tmp/tasks',
        mockFiles.architectLogFile,
        '/tmp/project',
        60000
      );
      
      // 5. Deve ter buscado plano
      expect(mocks.smartFileFinder.findRealArchitectPlan).toHaveBeenCalledWith(
        mockFiles.architectPlanFile,
        '/tmp/tasks',
        5
      );
      
      // 6. Deve ter analisado resposta
      expect(mocks.taskAnalysisService.analyzeArchitectResponse).toHaveBeenCalledWith(
        'Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.',
        mockTask,
        mockProject
      );
      
      // 7. Deve ter verificado existência de doneFile
      expect(mocks.fileUtils.fileExists).toHaveBeenCalledWith(mockFiles.doneFile);
      
      // 8. Deve ter escrito prompt atualizado (fluxo com plano)
      expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
        mockFiles.promptFile,
        expect.stringContaining('PLANO DE AÇÃO DO ARQUITETO')
      );
      
      // 9. Resultado deve indicar sucesso
      expect(result.architectPlanningResult.success).toBe(true);
      expect(result.architectPlanningResult.taskId).toBe(mockTask.id);
      expect(result.architectPlanningResult.hasArchitectPlan).toBe(true);
      expect(result.architectPlanningResult.hasArchitectExecution).toBe(false);
      expect(result.architectPlanningResult.confidence).toBe(85);
      expect(result.architectPlanningResult.promptUpdated).toBe(true);
      
      // 10. Contexto deve conter análise e plano
      expect(result.architectAnalysis).toEqual({
        hasExecuted: false,
        hasPlan: true,
        confidence: 85,
        executionDetails: null,
        planDetails: 'Plano detalhado gerado',
        analysisFailed: false
      });
      expect(result.architectPlan).toBe('Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.');
      expect(result.currentInput).toContain('PLANO DE AÇÃO DO ARQUITETO');
    });
    
    it('deve usar rawOutput quando arquivo não encontrado', async () => {
      // Configurar smartFileFinder para retornar sem conteúdo
      mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
        content: '',
        path: ''
      });
      
      // Configurar rawOutput longo
      mocks.openClawService.executeWithFallback.mockResolvedValue({
        rawOutput: 'Raw output longo do arquiteto com mais de 50 caracteres para ser usado como fallback',
        success: true
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      await step.execute(context);
      
      // Deve ter escrito rawOutput no arquivo de plano
      expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
        mockFiles.architectPlanFile,
        'Raw output longo do arquiteto com mais de 50 caracteres para ser usado como fallback'
      );
      
      // Deve ter logado sobre fallback
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Usando rawOutput do terminal como fallback')
      );
    });
    
    it('deve validar evidências quando arquiteto diz que executou', async () => {
      // Configurar análise indicando execução
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 80,
        executionDetails: 'Arquiteto executou a tarefa',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: true
      });
      
      // Configurar doneFile existente
      mocks.fileUtils.fileExists
        .mockResolvedValueOnce(true) // Para doneFile
        .mockResolvedValueOnce(false); // Para relatorioFile
      
      // Configurar snapshot com alterações
      mocks.workspaceSnapshotService.takeSnapshot.mockResolvedValue(
        new Map([
          ['/tmp/project/file1.js', 1234567890],
          ['/tmp/project/file2.js', 1234567890],
          ['/tmp/project/file3.js', 1234567890] // Novo arquivo
        ])
      );
      
      mocks.workspaceSnapshotService.compareSnapshots.mockReturnValue({
        modified: ['/tmp/project/file1.js'],
        created: ['/tmp/project/file3.js'],
        deleted: []
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      // Deve ter verificado evidências
      expect(mocks.workspaceSnapshotService.takeSnapshot).toHaveBeenCalledWith('/tmp/project');
      expect(mocks.workspaceSnapshotService.compareSnapshots).toHaveBeenCalled();
      
      // Deve ter logado sobre evidências confirmadas
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Evidências confirmadas:')
      );
      
      // Deve usar fluxo de execução concluída
      expect(result.currentInput).toContain('EXECUÇÃO CONCLUÍDA PELO ARQUITETO');
    });
    
    it('deve corrigir análise quando não há evidências', async () => {
      // Configurar análise indicando execução
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 80,
        executionDetails: 'Arquiteto executou',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Configurar doneFile não existente e snapshot sem alterações
      mocks.fileUtils.fileExists.mockResolvedValue(false);
      mocks.workspaceSnapshotService.takeSnapshot.mockResolvedValue(mockInitialSnapshot);
      mocks.workspaceSnapshotService.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: []
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado sobre falta de evidências
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('NENHUMA evidência encontrada')
      );
      
      // Deve ter corrigido análise
      expect(result.architectAnalysis.hasExecuted).toBe(false);
      expect(result.architectAnalysis.hasPlan).toBe(true);
      
      // Deve usar fluxo com plano
      expect(result.currentInput).toContain('PLANO DE AÇÃO DO ARQUITETO');
    });
    
    it('deve manter prompt original quando análise falhar', async () => {
      // Configurar análise falha
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true
      });
      
      // Configurar plano vazio
      mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
        content: '',
        path: ''
      });
      
      const originalInput = 'Prompt original da tarefa';
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: originalInput
      };
      
      const result = await step.execute(context);
      
      // Deve manter prompt original
      expect(result.currentInput).toBe(originalInput);
      
      // Deve ter logado sobre resposta vazia
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Resposta vazia ou inválida')
      );
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando contexto incompleto', async () => {
      const context = {
        task: mockTask
        // faltam files, config, etc.
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('contexto incompleto');
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com erro no OpenClawService', async () => {
      mocks.openClawService.executeWithFallback.mockRejectedValue(
        new Error('Erro no OpenClaw')
      );
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('Erro no OpenClaw');
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve lidar com erro na análise da resposta', async () => {
      mocks.taskAnalysisService.analyzeArchitectResponse.mockRejectedValue(
        new Error('Erro na análise')
      );
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('Erro na análise');
    });
  });
  
  describe('método estático planArchitect', () => {
    it('deve funcionar corretamente via método estático', async () => {
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await ArchitectPlanningStep.planArchitect(context);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(mockTask.id);
    });
  });
});