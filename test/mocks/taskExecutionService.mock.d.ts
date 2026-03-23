/**
 * Mock do TaskExecutionService para testes
 */
export function createTaskExecutionServiceMock(customizations?: {}): {
    ensureAndValidateEcosystem: jest.Mock<any, any, any>;
    verifyArchitectWork: jest.Mock<any, any, any>;
    readTaskOutputFile: jest.Mock<any, any, any>;
};
