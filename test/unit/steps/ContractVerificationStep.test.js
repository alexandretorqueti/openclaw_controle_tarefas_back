const ContractVerificationStep = require('../../src/steps/ContractVerificationStep');
const { createContractVerificationServiceMock } = require('../mocks/contractVerificationService.mock');
const { createEvidenceServiceMock } = require('../mocks/evidenceService.mock');

describe('ContractVerificationStep', () => {
  let step;
  let mockLog;
  let mockContractVerificationService;
  let mockEvidenceService;
  let mockFileUtils;
  let mockWorkspaceSnapshotService;

  beforeEach(() => {
    mockLog = jest.fn().mockResolvedValue();
    mockContractVerificationService = createContractVerificationServiceMock();
    mockEvidenceService = createEvidenceServiceMock();
    
    mockFileUtils = {
      fileExists: jest.fn().mockResolvedValue(true),
    };
    
    mockWorkspaceSnapshotService = {
      takeSnapshot: jest.fn().mockResolvedValue(new Map()),
    };

    step = new ContractVerificationStep({
      contractVerificationService: mockContractVerificationService,
      evidenceService: mockEvidenceService,
      fileUtils: mockFileUtils,
      workspaceSnapshotService: mockWorkspaceSnapshotService,
      log: mockLog
    });
    
    step.log = mockLog;
  });

  describe('validação de parâmetros', () => {
    it('deve falhar se task faltar', async () => {
      const result = await step.execute({ files: {}, config: {} });
      expect(result.contractVerificationResult.success).toBe(false);
    });
  });

  describe('execução bem-sucedida', () => {
    const validContext = {
      task: { id: 'task-123' },
      project: { pastaBase: '/tmp/project' },
      files: { doneFile: '/tmp/.done', relatorioFile: '/tmp/relatorio.md', terminalLogFile: '/tmp/term.log' },
      config: { TASKS_DIR: '/tmp/tasks' },
      evidence: { modifiedFiles: [] },
      analysisPlan: { taskType: 'development' },
      initialSnapshot: new Map()
    };

    it('deve verificar o contrato chamando o service correto', async () => {
      const result = await step.execute(validContext);

      expect(result.contractVerificationResult.success).toBe(true);
      expect(mockContractVerificationService.verifyContract).toHaveBeenCalledWith(
        '/tmp/.done',
        '/tmp/relatorio.md',
        '/tmp/term.log',
        expect.objectContaining({
          taskType: 'development',
          evidence: validContext.evidence
        })
      );
    });

    it('deve propagar contrato não cumprido com feedback', async () => {
      mockContractVerificationService.verifyContract.mockResolvedValue({
        contractFulfilled: false,
        feedbackToAgent: 'Faltam testes unitários',
        missingRequirements: ['testes']
      });

      const result = await step.execute(validContext);
      
      expect(result.contractVerificationResult.contractFulfilled).toBe(false);
      expect(result.contractVerificationResult.feedbackToAgent).toBe('Faltam testes unitários');
      expect(result.contractVerificationResult.missingRequirements).toEqual(['testes']);
    });

    it('deve usar arquivo .done customizado se recebido do turno anterior', async () => {
      await step.execute({
        ...validContext,
        actualDoneFilePath: '/tmp/rogue/.done'
      });
      
      expect(mockContractVerificationService.verifyContract.mock.calls[0][0]).toBe('/tmp/rogue/.done');
    });
  });
});