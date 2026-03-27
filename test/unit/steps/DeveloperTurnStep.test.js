const DeveloperTurnStep = require('../../src/steps/DeveloperTurnStep');
const { createOpenClawServiceMock } = require('../mocks/openClawService.mock');
const { createEvidenceServiceMock } = require('../mocks/evidenceService.mock');

describe('DeveloperTurnStep', () => {
  let step;
  let mockLog;
  let mockFileSystem;
  let mockPath;
  let mockOpenClawService;
  let mockEvidenceService;

  beforeEach(() => {
    mockLog = jest.fn().mockResolvedValue();
    mockOpenClawService = createOpenClawServiceMock();
    mockEvidenceService = createEvidenceServiceMock();
    
    mockFileSystem = {
      writeFile: jest.fn().mockResolvedValue(),
      readdir: jest.fn().mockResolvedValue([]),
    };
    
    mockPath = {
      join: jest.fn((...args) => args.join('/')),
    };

    step = new DeveloperTurnStep({
      openClawService: mockOpenClawService,
      evidenceService: mockEvidenceService,
      fileSystem: mockFileSystem,
      path: mockPath,
      log: mockLog
    });
    
    // Substitui o log injetado do container pelo mock
    step.log = mockLog;
  });

  describe('validação de parâmetros', () => {
    it('deve falhar se task faltar', async () => {
      const result = await step.execute({ files: {}, config: {} });
      expect(result.turnResult.success).toBe(false);
      expect(result.turnResult.error).toContain('contexto incompleto');
    });
  });

  describe('execução bem-sucedida', () => {
    const validContext = {
      task: { id: 'task-123', title: 'Test Task' },
      project: { pastaBase: '/tmp/project' },
      files: { terminalLogFile: '/tmp/term.log', doneFile: '/tmp/project/.done' },
      config: { TASKS_DIR: '/tmp/tasks', TASK_TIMEOUT_MS: 30000 },
      turnNumber: 1,
      basePrompt: 'System Prompt',
      lastFeedback: 'Fix this syntax error'
    };

    it('deve executar um turno corretamente chamando OpenClaw', async () => {
      mockOpenClawService.executeWithFallback.mockResolvedValue({
        success: true,
        toolCall: { name: 'exec', arguments: '{"command": "ls"}' },
        toolResult: { output: 'file1.js' },
        rawOutput: 'Done parsing'
      });

      const result = await step.execute(validContext);

      expect(result.turnResult.success).toBe(true);
      expect(result.turnResult.turnNumber).toBe(1);
      expect(mockOpenClawService.executeWithFallback).toHaveBeenCalled();
      expect(mockEvidenceService.applyExecutionEvidence).toHaveBeenCalled();
      expect(result.evidence).toBeDefined();
    });

    it('deve formatar o prompt incluindo feedback anterior', async () => {
      await step.execute(validContext);
      
      const executeArgs = mockOpenClawService.executeWithFallback.mock.calls[0];
      const promptSent = executeArgs[1];
      
      expect(promptSent).toContain('System Prompt');
      expect(promptSent).toContain('Fix this syntax error');
    });

    it('deve detectar truncamento de output json malformado', async () => {
      mockOpenClawService.executeWithFallback.mockResolvedValue({
        success: true,
        rawOutput: '{"incomplete": "json'
      });

      const result = await step.execute(validContext);
      
      expect(result.turnResult.truncatedInfo).toBeDefined();
      expect(result.turnResult.truncatedInfo.detected).toBe(true);
      expect(result.turnResult.feedbackForNextTurn).toContain('bloco JSON foi cortado');
    });
  });
});