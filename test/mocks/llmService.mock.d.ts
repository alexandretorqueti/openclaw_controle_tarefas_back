/**
 * Mock do LlmService para testes
 */
export function createLlmServiceMock(customizations?: {}): {
    analyze: jest.Mock<any, any, any>;
    generate: jest.Mock<any, any, any>;
    classify: jest.Mock<any, any, any>;
};
