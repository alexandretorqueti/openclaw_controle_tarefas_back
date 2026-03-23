/**
 * Mock do LockService para testes (retorna uma classe construtora)
 */
export function createLockServiceMock(customizations?: {}): {
    new (lockFile: any): {
        lockFile: any;
        checkLock: jest.Mock<any, any, any>;
        acquireLock: jest.Mock<any, any, any>;
        releaseLock: jest.Mock<any, any, any>;
        forceReleaseLock: jest.Mock<any, any, any>;
        killAndRelease: jest.Mock<any, any, any>;
        isProcessAlive: jest.Mock<any, any, any>;
    };
};
