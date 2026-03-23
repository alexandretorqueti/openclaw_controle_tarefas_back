/**
 * Mock do ContractVerificationService para testes
 */
export function createContractVerificationServiceMock(customizations?: {}): {
    verifyContract: jest.Mock<any, any, any>;
};
