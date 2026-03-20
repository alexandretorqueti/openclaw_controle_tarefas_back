// test/mocks/prismaService.mock.js

/**
 * Mock do PrismaService para testes
 * Simula os métodos mais comuns do PrismaClient
 */
function createPrismaServiceMock(customizations = {}) {
  const mock = {
    // Métodos comuns do PrismaClient
    project: {
      findUnique: jest.fn()
    },
    taskExecutionLog: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn()
    },
    // Adicione outros modelos conforme necessário
    ...customizations
  };
  
  // Implementações padrão
  mock.project.findUnique.mockResolvedValue(null); // Por padrão, sem projeto
  mock.taskExecutionLog.create.mockResolvedValue({ id: 'log-123', startedAt: new Date() });
  mock.taskExecutionLog.findUnique.mockResolvedValue({ id: 'log-123', startedAt: new Date() });
  mock.taskExecutionLog.update.mockResolvedValue({ id: 'log-123', finishedAt: new Date() });
  
  return mock;
}

module.exports = { createPrismaServiceMock };