// test/mocks/taskAnalysisService.mock.js

/**
 * Mock do TaskAnalysisService para testes
 */
function createTaskAnalysisServiceMock(customizations = {}) {
  const mock = {
    analyzeTaskScope: jest.fn(),
    analyzeArchitectResponse: jest.fn(),
    getFallbackScope: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.analyzeTaskScope.mockResolvedValue({
    taskType: 'development',
    scope: 'Moderate',
    mandatoryChecks: ['Verificar se a tarefa foi concluída corretamente'],
    finalizationInstructions: [
      'Escrever o resultado final no arquivo de relatorio.',
      'Criar o arquivo .done ao finalizar.'
    ]
  });
  
  mock.analyzeArchitectResponse.mockResolvedValue({
    hasExecuted: false,
    hasPlan: true,
    confidence: 80,
    executionDetails: null,
    planDetails: 'Plano detalhado gerado pelo arquiteto',
    analysisFailed: false
  });
  
  mock.getFallbackScope.mockReturnValue({
    taskType: 'automation',
    scope: 'Simple',
    mandatoryChecks: ['Verificar execução básica'],
    finalizationInstructions: ['Finalizar com .done']
  });
  
  return mock;
}

module.exports = { createTaskAnalysisServiceMock };