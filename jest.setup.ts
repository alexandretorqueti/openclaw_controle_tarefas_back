import { jest } from '@jest/globals';

// Configurações globais do Jest
jest.setTimeout(10000);

// Mock global do console para testes mais limpos
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};
