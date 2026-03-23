/**
 * Mock do JsonUtils para testes
 */
export function createJsonUtilsMock(customizations?: {}): {
    extractJsonObjects: jest.Mock<any, any, any>;
};
