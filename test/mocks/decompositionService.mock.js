// test/mocks/decompositionService.mock.js

/**
 * Mock do DecompositionService para testes
 */
function createDecompositionServiceMock(customizations = {}) {
  const mock = {
    decompose: jest.fn(),
    ...customizations
  };
  
  mock.decompose.mockImplementation(async (parentTaskId, subtasks) => {
    return {
      parentTaskId,
      subtasksCreated: subtasks.length,
      subtaskIds: subtasks.map((_, i) => `subtask-${parentTaskId}-${i}`)
    };
  });
  
  return mock;
}

module.exports = { createDecompositionServiceMock };