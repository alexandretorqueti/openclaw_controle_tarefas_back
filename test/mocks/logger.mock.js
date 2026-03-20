// test/mocks/logger.mock.js

/**
 * Mock da função de log para testes
 */
function createLoggerMock(customizations = {}) {
  const mock = jest.fn();
  
  // Adiciona métodos auxiliares para assertions
  mock.info = jest.fn();
  mock.error = jest.fn();
  mock.warn = jest.fn();
  mock.debug = jest.fn();
  
  // Implementação padrão: log no console durante testes (opcional)
  mock.mockImplementation((message) => {
    if (process.env.DEBUG_TESTS) {
      console.log(`[TEST LOG] ${message}`);
    }
  });
  
  // Copia customizações
  Object.assign(mock, customizations);
  
  return mock;
}

module.exports = { createLoggerMock };