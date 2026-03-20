// test/mocks/taskExecutionService.mock.js

/**
 * Mock do TaskExecutionService para testes
 */
function createTaskExecutionServiceMock(customizations = {}) {
  const mock = {
    ensureAndValidateEcosystem: jest.fn(),
    verifyArchitectWork: jest.fn(),
    readTaskOutputFile: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.ensureAndValidateEcosystem.mockResolvedValue({
    passed: true,
    message: 'Ecosistema validado com sucesso'
  });
  
  mock.verifyArchitectWork.mockResolvedValue(null); // Por padrão, arquiteto não fez a tarefa
  
  mock.readTaskOutputFile.mockResolvedValue('Conteúdo do arquivo de saída');
  
  return mock;
}

module.exports = { createTaskExecutionServiceMock };