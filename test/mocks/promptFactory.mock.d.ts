/**
 * Mock do PromptFactory para testes
 */
export function createPromptFactoryMock(customizations?: {}): {
    buildDecompositionPrompt: jest.Mock<any, any, any>;
    buildArchitectPrompt: jest.Mock<any, any, any>;
    buildTaskAnalysisPrompt: jest.Mock<any, any, any>;
    buildValidationPrompt: jest.Mock<any, any, any>;
    buildEngineRulesPrompt: jest.Mock<any, any, any>;
};
