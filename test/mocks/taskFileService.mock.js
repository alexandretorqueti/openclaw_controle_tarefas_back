// test/mocks/taskFileService.mock.js

/**
 * Mock do TaskFileService para testes (retorna uma classe construtora)
 */
function createTaskFileServiceMock(customizations = {}) {
  // Criamos uma classe mock
  class MockTaskFileService {
    constructor() {
      this.getTaskFilePaths = jest.fn();
      this.moveTaskFiles = jest.fn();
      this.prepareTaskFiles = jest.fn();
      this.generatePromptContent = jest.fn();
      this.cleanupFiles = jest.fn();
      
      // Implementações padrão
      this.moveTaskFiles.mockResolvedValue(true);
      this.getTaskFilePaths.mockImplementation((taskId, tasksDir) => ({
        promptFile: `${tasksDir}/prompt-${taskId}.txt`,
        relatorioFile: `${tasksDir}/relatorio-${taskId}.txt`,
        doneFile: `${tasksDir}/done-${taskId}.done`,
        terminalLogFile: `${tasksDir}/terminal-${taskId}.log`
      }));
      
      // Aplica customizações
      Object.assign(this, customizations);
    }
  }
  
  return MockTaskFileService;
}

module.exports = { createTaskFileServiceMock };