// test/mocks/projectService.mock.js

/**
 * Mock do ProjectService para testes
 */
function createProjectServiceMock(customizations = {}) {
  const mock = {
    getProject: jest.fn(),
    updateProject: jest.fn(),
    getProjectConfig: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.getProject.mockResolvedValue({
    id: 'project-123',
    name: 'Test Project',
    pastaBase: '/tmp/project',
    frontendPath: 'frontend',
    backendPath: 'backend',
    frontendPort: 3000,
    backendPort: 4001
  });
  
  mock.updateProject.mockResolvedValue(true);
  mock.getProjectConfig.mockResolvedValue({
    buildCommands: {
      frontend: 'npm run build',
      backend: 'npm start'
    },
    ports: {
      frontend: 3000,
      backend: 4001
    }
  });
  
  return mock;
}

module.exports = { createProjectServiceMock };