const DeveloperLoopOrchestrator = require('../../src/steps/DeveloperLoopOrchestrator');
const { createTaskExecutionServiceMock } = require('../mocks/taskExecutionService.mock');
const { createEvidenceServiceMock } = require('../mocks/evidenceService.mock');

jest.mock('../../../src/steps/DeveloperTurnStep', () => {
  return jest.fn().mockImplementation(() => {
    return { execute: jest.fn().mockResolvedValue({ turnResult: { success: false, error: 'mock error' } }) };
  });
});
jest.mock('../../../src/steps/ContractVerificationStep', () => {
  return jest.fn().mockImplementation(() => {
    return { execute: jest.fn().mockResolvedValue({ contractVerificationResult: { success: true }, contractResult: { contractFulfilled: false } }) };
  });
});
jest.mock('../../../src/steps/EcosystemValidationStep', () => {
  return jest.fn().mockImplementation(() => {
    return { execute: jest.fn().mockResolvedValue({ ecosystemValidationResult: { success: true, passed: true } }) };
  });
});

describe('DeveloperLoopOrchestrator', () => {
  let orchestrator;
  let mockLog;
  let mockSessionChainUtils;
  let mockTaskExecutionService;
  let mockEvidenceService;
  let mockFileSystem;
  let mockPath;

  beforeEach(() => {
    mockLog = jest.fn().mockResolvedValue();
    mockTaskExecutionService = createTaskExecutionServiceMock();
    mockEvidenceService = createEvidenceServiceMock();
    
    mockSessionChainUtils = {
      getTaskChain: jest.fn().mockResolvedValue([]),
    };
    
    mockFileSystem = {
      writeFile: jest.fn().mockResolvedValue(),
      readFile: jest.fn().mockResolvedValue('conteudo'),
      unlink: jest.fn().mockResolvedValue(),
    };
    
    mockPath = {
      join: jest.fn((...args) => args.join('/')),
    };

    orchestrator = new DeveloperLoopOrchestrator({
      sessionChainUtils: mockSessionChainUtils,
      taskExecutionService: mockTaskExecutionService,
      evidenceService: mockEvidenceService,
      fileSystem: mockFileSystem,
      path: mockPath,
      log: mockLog
    });
    
    orchestrator.log = mockLog;
  });

  describe('validação de parâmetros', () => {
    it('deve falhar se task faltar', async () => {
      const result = await orchestrator.execute({ files: {}, config: {} });
      expect(result.developerLoopResult.success).toBe(false);
    });
  });

  describe('execução bem-sucedida', () => {
    const validContext = {
      task: { id: 'task-123', title: 'Task Test' },
      project: { pastaBase: '/tmp/project' },
      files: { promptFile: '/tmp/prompt.txt' },
      config: { TASKS_DIR: '/tmp/tasks' },
      analysisPlan: { taskType: 'development' },
      currentInput: 'Faz um botao verde',
      architectPlan: 'plano de arquitetura'
    };

    it('deve pular o loop se o arquiteto já executou a tarefa', async () => {
      mockTaskExecutionService.verifyArchitectWork.mockResolvedValue({
        success: true,
        contractResult: { contractFulfilled: true },
        finalResult: { success: true }
      });

      const result = await orchestrator.execute(validContext);

      expect(result.developerLoopResult.skipped).toBe(true);
      expect(result.contractResult.contractFulfilled).toBe(true);
    });

    it('deve buscar histórico de tarefas anteriores', async () => {
      mockSessionChainUtils.getTaskChain.mockResolvedValue([
        { id: 'task-000', title: 'Old Task' },
        { id: 'task-123', title: 'Task Test' } // This is current
      ]);

      // Força o erro no mock do DeveloperTurnStep para abortar o loop
      mockTaskExecutionService.readTaskOutputFile.mockResolvedValue('old report');
      mockTaskExecutionService.verifyArchitectWork.mockResolvedValue(null);

      await orchestrator.execute(validContext);

      expect(mockSessionChainUtils.getTaskChain).toHaveBeenCalledWith('task-123');
      expect(mockTaskExecutionService.readTaskOutputFile).toHaveBeenCalled();
      expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Contexto de 1 tarefas anteriores carregado'));
    });
  });
});