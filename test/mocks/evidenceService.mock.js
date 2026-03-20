// test/mocks/evidenceService.mock.js

/**
 * Mock do EvidenceService para testes
 */
function createEvidenceServiceMock(customizations = {}) {
  const mock = {
    createEmptyEvidence: jest.fn(),
    collectEvidence: jest.fn(),
    validateEvidence: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.createEmptyEvidence.mockReturnValue({
    doneFileExists: false,
    reportFileExists: false,
    modifiedFiles: [],
    createdFiles: [],
    deletedFiles: [],
    terminalOutput: '',
    snapshotChanges: {
      modified: [],
      created: [],
      deleted: []
    }
  });
  
  mock.collectEvidence.mockResolvedValue({
    doneFileExists: false,
    reportFileExists: false,
    modifiedFiles: [],
    createdFiles: [],
    deletedFiles: [],
    terminalOutput: '',
    snapshotChanges: {
      modified: [],
      created: [],
      deleted: []
    }
  });
  
  mock.validateEvidence.mockResolvedValue({
    isValid: true,
    missing: [],
    warnings: []
  });
  
  mock.computeTurnProgress = jest.fn().mockReturnValue({
    hasMeaningfulProgress: true,
    progressScore: 0.7,
    changesDetected: [],
    toolUsed: 'exec'
  });
  
  mock.applyExecutionEvidence = jest.fn();
  
  return mock;
}

module.exports = { createEvidenceServiceMock };