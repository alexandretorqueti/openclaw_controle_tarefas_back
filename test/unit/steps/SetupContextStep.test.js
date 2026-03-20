// test/unit/steps/SetupContextStep.test.js

const container = require('../../../src/container');
const SetupContextStep = require('../../../src/steps/SetupContextStep');

// Importar factories de mocks
const { createLoggerMock } = require('../../mocks/logger.mock');
const { createPrismaServiceMock } = require('../../mocks/prismaService.mock');
const { createTaskAnalysisServiceMock } = require('../../mocks/taskAnalysisService.mock');
const { createWorkspaceSnapshotServiceMock } = require('../../mocks/workspaceSnapshotService.mock');
const { createPromptFactoryMock } = require('../../mocks/promptFactory.mock');
const { createFileUtilsMock } = require('../../mocks/fileUtils.mock');

describe('SetupContextStep', () => {
  let step;
  let mocks;
  
  const mockTask = {
    id: 'task-setup-123',
    title: 'Tarefa de setup',
    description: 'Descrição da tarefa',
    projectId: 'project-456',
    comments: [
      {
        user: { name: 'Alexandre', nickname: 'alexandre' },
        content: 'Primeiro comentário',
        createdAt: new Date().toISOString()
      },
      {
        user: { name: 'Jarbas', nickname: 'jarbas' },
        content: 'Segundo comentário',
        createdAt: new Date().toISOString()
      }
    ]
  };
  
  const mockProject = {
    id: 'project-456',
    name: 'Projeto Teste',
    pastaBase: '/tmp/project'
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar config fresh para cada teste
    const mockConfig = {
      TASKS_DIR: '/tmp/tasks'
    };
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      config: mockConfig,
      fileSystem: {
        writeFile: jest.fn().mockResolvedValue(undefined)
      },
      path: require('path')
    };
    
    // Criar mocks dos serviços
    mocks.prisma = createPrismaServiceMock();
    mocks.taskAnalysisService = createTaskAnalysisServiceMock();
    mocks.workspaceSnapshotService = createWorkspaceSnapshotServiceMock();
    mocks.promptFactory = createPromptFactoryMock();
    mocks.fileUtils = createFileUtilsMock();
    
    // Configurar mocks específicos
    mocks.prisma.project.findUnique.mockResolvedValue(mockProject);
    mocks.workspaceSnapshotService.takeSnapshot.mockResolvedValue(
      new Map([
        ['/tmp/project/file1.js', 1234567890],
        ['/tmp/project/file2.js', 1234567890]
      ])
    );
    
    mocks.promptFactory.buildArchitectPrompt.mockReturnValue('Prompt do arquiteto gerado');
    mocks.promptFactory.buildEngineRulesPrompt.mockReturnValue('Regras do engine');
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('config', mocks.config);
    container.register('fileSystem', mocks.fileSystem);
    container.register('path', mocks.path);
    container.register('prisma', mocks.prisma);
    container.register('taskAnalysisService', mocks.taskAnalysisService);
    container.register('workspaceSnapshotService', mocks.workspaceSnapshotService);
    container.register('promptFactory', mocks.promptFactory);
    container.register('fileUtils', mocks.fileUtils);
    
    // Criar instância do step
    step = new SetupContextStep();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve preparar contexto completo com projeto', async () => {
      const context = {
        task: mockTask,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      // 1. Deve ter buscado projeto
      expect(mocks.prisma.project.findUnique).toHaveBeenCalledWith({
        where: { id: mockTask.projectId }
      });
      
      // 2. Deve ter analisado escopo
      expect(mocks.taskAnalysisService.analyzeTaskScope).toHaveBeenCalledWith(
        mockTask,
        mockProject,
        expect.stringContaining('terminal-pre-analise-')
      );
      
      // 3. Deve ter tirado snapshot
      expect(mocks.workspaceSnapshotService.takeSnapshot).toHaveBeenCalledWith(
        mockProject.pastaBase
      );
      
      // 4. Deve ter gerado prompt do arquiteto
      expect(mocks.promptFactory.buildArchitectPrompt).toHaveBeenCalledWith(
        mockTask,
        mockProject,
        expect.any(Array), // fileList
        expect.stringContaining('plano-arquiteto-'),
        expect.stringContaining('COMENTÁRIOS DA TAREFA'),
        'development' // taskType da análise
      );
      
      // 5. Deve ter salvo arquivos
      expect(mocks.fileSystem.writeFile).toHaveBeenCalledTimes(3); // backup, prompt, terminal
      
      // 6. Deve ter gerado prompt do desenvolvedor
      expect(mocks.promptFactory.buildEngineRulesPrompt).toHaveBeenCalled();
      
      // 7. Resultado deve indicar sucesso
      expect(result.setupResult.success).toBe(true);
      expect(result.setupResult.taskId).toBe(mockTask.id);
      expect(result.setupResult.filesPrepared).toBe(6); // 6 arquivos no objeto files
      expect(result.setupResult.fileListCount).toBe(2); // 2 arquivos no snapshot
      expect(result.setupResult.taskType).toBe('development');
      
      // 8. Contexto deve conter dados preparados
      expect(result.project).toEqual(mockProject);
      expect(result.analysisPlan).toBeDefined();
      expect(result.files).toBeDefined();
      expect(result.initialSnapshot).toBeInstanceOf(Map);
      expect(result.currentInput).toBe('Prompt do arquiteto gerado');
      expect(result.developerPrompt).toContain('DESENVOLVEDOR:');
      expect(result.commentsSection).toContain('COMENTÁRIOS DA TAREFA');
      expect(result.executionLogData).toEqual({
        taskId: mockTask.id,
        userId: 'user-123',
        model: 'deepseek/deepseek-chat',
        startedAt: expect.any(Date)
      });
    });
    
    it('deve preparar contexto sem projeto', async () => {
      // Task sem projectId
      const taskSemProjeto = { ...mockTask, projectId: null };
      mocks.prisma.project.findUnique.mockResolvedValue(null);
      
      const context = {
        task: taskSemProjeto,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      // Deve ter usado TASKS_DIR como base para snapshot
      expect(mocks.workspaceSnapshotService.takeSnapshot).toHaveBeenCalledWith(
        '/tmp/tasks'
      );
      
      // Prompt deve ser gerado sem projeto
      expect(mocks.promptFactory.buildArchitectPrompt).toHaveBeenCalledWith(
        taskSemProjeto,
        null,
        expect.any(Array),
        expect.any(String),
        expect.any(String),
        'development'
      );
      
      expect(result.setupResult.success).toBe(true);
    });
    
    it('deve preparar contexto sem comentários', async () => {
      const taskSemComentarios = { ...mockTask, comments: [] };
      
      const context = {
        task: taskSemComentarios,
        userId: 'user-123'
      };
      
      await step.execute(context);
      
      // Prompt não deve incluir seção de comentários
      expect(mocks.promptFactory.buildArchitectPrompt).toHaveBeenCalledWith(
        taskSemComentarios,
        mockProject,
        expect.any(Array),
        expect.any(String),
        '', // commentsSection vazia
        'development'
      );
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando task não for fornecida', async () => {
      const context = {
        userId: 'user-123'
        // task faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.setupResult.success).toBe(false);
      expect(result.setupResult.error).toContain('task inválida ou sem ID');
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve falhar quando task não tem ID', async () => {
      const taskSemId = { title: 'Tarefa sem ID' };
      
      const context = {
        task: taskSemId,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      expect(result.setupResult.success).toBe(false);
      expect(result.setupResult.error).toContain('task inválida ou sem ID');
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com erro ao buscar projeto', async () => {
      mocks.prisma.project.findUnique.mockRejectedValue(
        new Error('Erro de banco de dados')
      );
      
      const context = {
        task: mockTask,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro no SetupContextStep')
      );
      
      // Resultado deve indicar falha
      expect(result.setupResult.success).toBe(false);
      expect(result.setupResult.error).toContain('Erro de banco de dados');
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve lidar com erro ao analisar escopo', async () => {
      mocks.taskAnalysisService.analyzeTaskScope.mockRejectedValue(
        new Error('Erro na análise')
      );
      
      const context = {
        task: mockTask,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      expect(result.setupResult.success).toBe(false);
      expect(result.setupResult.error).toContain('Erro na análise');
    });
    
    it('deve lidar com erro ao salvar arquivos', async () => {
      mocks.fileSystem.writeFile.mockRejectedValue(
        new Error('Erro de filesystem')
      );
      
      const context = {
        task: mockTask,
        userId: 'user-123'
      };
      
      const result = await step.execute(context);
      
      expect(result.setupResult.success).toBe(false);
      expect(result.setupResult.error).toContain('Erro de filesystem');
    });
  });
  
  describe('método estático setupContext', () => {
    it('deve funcionar corretamente via método estático', async () => {
      const result = await SetupContextStep.setupContext(mockTask, 'user-123');
      
      // Deve retornar resultado
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(mockTask.id);
    });
  });
});