/**
 * Mock do OpenClawService para testes
 */
export function createOpenClawServiceMock(customizations?: {}): {
    executeWithFallback: jest.Mock<any, any, any>;
    executeOptimized: jest.Mock<any, any, any>;
};
