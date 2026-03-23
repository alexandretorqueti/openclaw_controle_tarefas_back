/**
 * Mock do DecompositionService para testes
 */
export function createDecompositionServiceMock(customizations?: {}): {
    decompose: jest.Mock<any, any, any>;
};
