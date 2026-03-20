// test/mocks/smartFileFinder.mock.js

/**
 * Mock do SmartFileFinder para testes
 */
function createSmartFileFinderMock(customizations = {}) {
  const mock = {
    findRealArchitectPlan: jest.fn(),
    sleep: jest.fn().mockResolvedValue(undefined),
    ...customizations
  };
  
  // Implementações padrão
  mock.findRealArchitectPlan.mockResolvedValue({
    content: 'Plano do arquiteto mockado',
    path: '/tmp/tasks/plano-arquiteto-task-123.txt'
  });
  
  return mock;
}

module.exports = { createSmartFileFinderMock };