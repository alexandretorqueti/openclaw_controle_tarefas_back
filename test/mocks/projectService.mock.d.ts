/**
 * Mock do ProjectService para testes
 */
export function createProjectServiceMock(customizations?: {}): {
    getProject: jest.Mock<any, any, any>;
    updateProject: jest.Mock<any, any, any>;
    getProjectConfig: jest.Mock<any, any, any>;
};
