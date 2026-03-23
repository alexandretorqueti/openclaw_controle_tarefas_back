/**
 * Mock do PrismaService para testes
 * Simula os métodos mais comuns do PrismaClient
 */
export function createPrismaServiceMock(customizations?: {}): {
    project: {
        findUnique: jest.Mock<any, any, any>;
    };
    taskExecutionLog: {
        create: jest.Mock<any, any, any>;
        findUnique: jest.Mock<any, any, any>;
        update: jest.Mock<any, any, any>;
    };
};
