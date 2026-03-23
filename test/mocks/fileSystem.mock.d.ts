/**
 * Mock do sistema de arquivos (compatível com fs.promises)
 */
export function createFileSystemMock(customizations?: {}): {
    writeFile: jest.Mock<any, any, any>;
    readFile: jest.Mock<any, any, any>;
    unlink: jest.Mock<any, any, any>;
    mkdir: jest.Mock<any, any, any>;
    stat: jest.Mock<any, any, any>;
    access: jest.Mock<any, any, any>;
};
