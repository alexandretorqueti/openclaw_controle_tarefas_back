// test/mocks/agentService.mock.js

/**
 * Mock do AgentService para testes
 */
function createAgentServiceMock(customizations = {}) {
  const mock = {
    getAgentConfig: jest.fn(),
    selectAgentForTask: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.getAgentConfig.mockResolvedValue({
    id: 'main',
    name: 'Main Agent',
    model: 'deepseek/deepseek-chat',
    capabilities: ['code', 'analysis', 'execution']
  });
  
  mock.selectAgentForTask.mockResolvedValue({
    primary: 'main',
    fallback: 'main',
    reason: 'Default agent selection'
  });
  
  return mock;
}

module.exports = { createAgentServiceMock };