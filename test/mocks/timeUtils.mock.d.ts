/**
 * Mock do TimeUtils para testes
 */
export function createTimeUtilsMock(customizations?: {}): {
    segundosToMinutos_Segundos: jest.Mock<any, any, any>;
    msToReadable: jest.Mock<any, any, any>;
    getLogTimestamp: jest.Mock<any, any, any>;
    isPastDate: jest.Mock<any, any, any>;
    addMinutes: jest.Mock<any, any, any>;
    isProcessAlive: jest.Mock<any, any, any>;
};
