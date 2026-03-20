// test/mocks/taskService.mock.js

/**
 * Mock do TaskService para testes
 */
function createTaskServiceMock(customizations = {}) {
  const mock = {
    updateTask: jest.fn(),
    getNextTaskByNickname: jest.fn(),
    createTask: jest.fn(),
    ...customizations
  };
  
  mock.updateTask.mockImplementation(async (taskId, data) => {
    return { id: taskId, ...data };
  });
  
  return mock;
}

module.exports = { createTaskServiceMock };