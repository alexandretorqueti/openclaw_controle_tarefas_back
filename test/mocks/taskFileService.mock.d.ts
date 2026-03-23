/**
 * Mock do TaskFileService para testes (retorna uma classe construtora)
 */
export function createTaskFileServiceMock(customizations?: {}): {
    new (): {
        getTaskFilePaths: jest.Mock<any, any, any>;
        moveTaskFiles: jest.Mock<any, any, any>;
        prepareTaskFiles: jest.Mock<any, any, any>;
        generatePromptContent: jest.Mock<any, any, any>;
        cleanupFiles: jest.Mock<any, any, any>;
    };
};
