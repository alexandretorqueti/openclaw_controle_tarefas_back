/**
 * Mock do TaskAnalysisService para testes
 */
export function createTaskAnalysisServiceMock(customizations?: {}): {
    analyzeTaskScope: jest.Mock<any, any, any>;
    analyzeArchitectResponse: jest.Mock<any, any, any>;
    getFallbackScope: jest.Mock<any, any, any>;
};
