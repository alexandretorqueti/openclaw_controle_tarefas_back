// test/mocks/fileSystem.mock.js

/**
 * Mock do sistema de arquivos (compatível com fs.promises)
 */
function createFileSystemMock(customizations = {}) {
  const files = new Map();
  
  const mock = {
    writeFile: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
    stat: jest.fn(),
    access: jest.fn(),
    ...customizations
  };
  
  // Implementação em memória simples
  mock.writeFile.mockImplementation(async (path, content) => {
    files.set(path, content);
  });
  
  mock.readFile.mockImplementation(async (path, encoding = 'utf8') => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return files.get(path);
  });
  
  mock.unlink.mockImplementation(async (path) => {
    files.delete(path);
  });
  
  mock.stat.mockImplementation(async (path) => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return {
      isFile: () => true,
      isDirectory: () => false,
      size: files.get(path).length
    };
  });
  
  mock.access.mockImplementation(async (path) => {
    if (!files.has(path)) {
      throw new Error(`ENOENT: no such file or directory, access '${path}'`);
    }
  });
  
  // Método auxiliar para verificar se arquivo foi escrito
  mock.getFileContent = (path) => files.get(path);
  mock.hasFile = (path) => files.has(path);
  
  return mock;
}

module.exports = { createFileSystemMock };