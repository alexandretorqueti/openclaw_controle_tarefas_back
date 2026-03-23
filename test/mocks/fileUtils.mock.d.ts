/**
 * Mock do FileUtils para testes
 */
export function createFileUtilsMock(customizations?: {}): {
    fileExists: jest.Mock<any, any, any>;
    ensureDir: jest.Mock<any, any, any>;
    safeWrite: jest.Mock<any, any, any>;
    readIfExists: jest.Mock<any, any, any>;
};
