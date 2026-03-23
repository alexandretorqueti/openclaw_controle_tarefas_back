/**
 * Mock do AgentService para testes
 */
export function createAgentServiceMock(customizations?: {}): {
    getAgentConfig: jest.Mock<any, any, any>;
    selectAgentForTask: jest.Mock<any, any, any>;
};
