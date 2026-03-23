/**
 * Mock do TaskService para testes
 */
export function createTaskServiceMock(customizations?: {}): {
    updateTask: jest.Mock<any, any, any>;
    getNextTaskByNickname: jest.Mock<any, any, any>;
    createTask: jest.Mock<any, any, any>;
};
