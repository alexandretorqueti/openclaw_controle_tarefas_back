// test/mocks/contractVerificationService.mock.js

/**
 * Mock do ContractVerificationService para testes
 */
function createContractVerificationServiceMock(customizations = {}) {
  const mock = {
    verifyContract: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.verifyContract.mockResolvedValue({
    contractFulfilled: true,
    executionNotes: 'Contrato cumprido com sucesso',
    feedbackToAgent: null,
    evidence: {},
    missingRequirements: []
  });
  
  return mock;
}

module.exports = { createContractVerificationServiceMock };