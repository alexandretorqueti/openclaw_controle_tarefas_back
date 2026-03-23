/**
 * Mock do EvidenceService para testes
 */
export function createEvidenceServiceMock(customizations?: {}): {
    createEmptyEvidence: jest.Mock<any, any, any>;
    collectEvidence: jest.Mock<any, any, any>;
    validateEvidence: jest.Mock<any, any, any>;
};
