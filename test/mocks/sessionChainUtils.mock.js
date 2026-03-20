// test/mocks/sessionChainUtils.mock.js

/**
 * Mock do SessionChainUtils para testes
 */
function createSessionChainUtilsMock(customizations = {}) {
  const mock = {
    generateUnifiedSessionId: jest.fn(),
    ...customizations
  };
  
  mock.generateUnifiedSessionId.mockImplementation(async (taskId, role) => {
    return `mock-session-${taskId}-${role}`;
  });
  
  return mock;
}

module.exports = { createSessionChainUtilsMock };