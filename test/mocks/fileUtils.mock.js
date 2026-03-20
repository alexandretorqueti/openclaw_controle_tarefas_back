// test/mocks/fileUtils.mock.js

/**
 * Mock do FileUtils para testes
 */
function createFileUtilsMock(customizations = {}) {
  const mock = {
    fileExists: jest.fn(),
    ensureDir: jest.fn(),
    safeWrite: jest.fn(),
    readIfExists: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.fileExists.mockResolvedValue(false); // Por padrão, arquivo não existe
  
  return mock;
}

module.exports = { createFileUtilsMock };