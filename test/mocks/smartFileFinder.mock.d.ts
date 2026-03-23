/**
 * Mock do SmartFileFinder para testes
 */
export function createSmartFileFinderMock(customizations?: {}): {
    findRealArchitectPlan: jest.Mock<any, any, any>;
    sleep: jest.Mock<any, any, any>;
};
