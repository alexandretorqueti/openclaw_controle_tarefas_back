// test/setup.js
// Configurações globais para testes Jest

// Aumentar timeout para testes de integração
jest.setTimeout(30000);

// Mock global do console para evitar poluição nos logs
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Limpar todos os mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
});