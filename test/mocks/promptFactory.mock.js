// test/mocks/promptFactory.mock.js

/**
 * Mock do PromptFactory para testes
 */
function createPromptFactoryMock(customizations = {}) {
  const mock = {
    buildDecompositionPrompt: jest.fn(),
    buildArchitectPrompt: jest.fn(),
    buildTaskAnalysisPrompt: jest.fn(),
    buildValidationPrompt: jest.fn(),
    buildEngineRulesPrompt: jest.fn(),
    ...customizations
  };
  
  // Implementação padrão
  mock.buildDecompositionPrompt.mockImplementation((task) => {
    return `Mock decomposition prompt for task: ${task.title}`;
  });
  
  return mock;
}

module.exports = { createPromptFactoryMock };