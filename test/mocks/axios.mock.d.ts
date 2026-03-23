/**
 * Mock do Axios para testes
 */
export function createAxiosMock(customizations?: {}): {
    get: jest.Mock<any, any, any>;
    post: jest.Mock<any, any, any>;
    put: jest.Mock<any, any, any>;
    patch: jest.Mock<any, any, any>;
    delete: jest.Mock<any, any, any>;
};
