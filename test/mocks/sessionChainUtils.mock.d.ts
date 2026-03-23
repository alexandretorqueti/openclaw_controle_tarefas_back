/**
 * Mock do SessionChainUtils para testes
 */
export function createSessionChainUtilsMock(customizations?: {}): {
    generateUnifiedSessionId: jest.Mock<any, any, any>;
};
