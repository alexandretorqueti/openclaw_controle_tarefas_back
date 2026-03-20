// test/mocks/llmService.mock.js

/**
 * Mock do LlmService para testes
 */
function createLlmServiceMock(customizations = {}) {
  const mock = {
    analyze: jest.fn(),
    generate: jest.fn(),
    classify: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.analyze.mockResolvedValue({
    comando: 'npm start',
    escopo: 'front'
  });
  
  mock.generate.mockResolvedValue('Texto gerado pela IA');
  mock.classify.mockResolvedValue('development');
  
  return mock;
}

module.exports = { createLlmServiceMock };