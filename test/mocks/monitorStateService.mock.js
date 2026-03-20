// test/mocks/monitorStateService.mock.js

/**
 * Mock do MonitorStateService para testes (retorna uma classe construtora)
 */
function createMonitorStateServiceMock(customizations = {}) {
  // Criamos uma classe mock
  class MockMonitorStateService {
    constructor(tasksDir) {
      this.tasksDir = tasksDir;
      this.readState = jest.fn();
      this.saveState = jest.fn();
      this.registerActiveTask = jest.fn();
      this.cleanupTask = jest.fn();
      this.getActiveTask = jest.fn();
      this.getActiveTasks = jest.fn();
      this.getTaskElapsedTime = jest.fn();
      this.isTaskTimedOut = jest.fn();
      this.clearState = jest.fn();
      
      // Implementações padrão
      this.cleanupTask.mockResolvedValue(true);
      this.clearState.mockResolvedValue(true);
      this.getActiveTasks.mockResolvedValue({});
      this.registerActiveTask.mockResolvedValue(true);
      
      // Aplica customizações
      Object.assign(this, customizations);
    }
  }
  
  return MockMonitorStateService;
}

module.exports = { createMonitorStateServiceMock };