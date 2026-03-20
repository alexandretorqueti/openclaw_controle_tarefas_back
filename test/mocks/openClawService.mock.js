// test/mocks/openClawService.mock.js

/**
 * Mock do OpenClawService para testes
 */
function createOpenClawServiceMock(customizations = {}) {
  const mock = {
    executeWithFallback: jest.fn(),
    executeOptimized: jest.fn(),
    ...customizations
  };
  
  // Implementação padrão que simula sucesso
  mock.executeWithFallback.mockImplementation(async (
    taskId, inputMessage, primaryAgent, fallbackAgent, model, tasksDir, terminalLogFile, projectPath, timeoutMs
  ) => ({
    success: true,
    rawOutput: JSON.stringify([
      {
        title: "[BACKEND] Criar endpoint de login",
        description: "Criar rota POST /api/auth/login com validação JWT",
        domain: "BACKEND"
      },
      {
        title: "[FRONTEND] Criar tela de login",
        description: "Criar componente LoginForm com campos email e senha",
        domain: "FRONTEND"
      }
    ]),
    errorMessage: null,
    sessionId: `mock-session-${taskId}`,
    durationMs: 1500
  }));
  
  return mock;
}

module.exports = { createOpenClawServiceMock };