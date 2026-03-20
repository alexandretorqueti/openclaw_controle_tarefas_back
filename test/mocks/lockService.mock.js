// test/mocks/lockService.mock.js

/**
 * Mock do LockService para testes (retorna uma classe construtora)
 */
function createLockServiceMock(customizations = {}) {
  // Criamos uma classe mock
  class MockLockService {
    constructor(lockFile) {
      this.lockFile = lockFile;
      this.checkLock = jest.fn();
      this.acquireLock = jest.fn();
      this.releaseLock = jest.fn();
      this.forceReleaseLock = jest.fn();
      this.killAndRelease = jest.fn();
      this.isProcessAlive = jest.fn();
      
      // Implementações padrão
      this.releaseLock.mockResolvedValue(true);
      this.forceReleaseLock.mockResolvedValue(true);
      this.acquireLock.mockResolvedValue(true);
      this.checkLock.mockResolvedValue({
        locked: false,
        ageRecent: false,
        corrupted: false,
        pid: null,
        alive: false
      });
      
      // Aplica customizações
      Object.assign(this, customizations);
    }
  }
  
  return MockLockService;
}

module.exports = { createLockServiceMock };