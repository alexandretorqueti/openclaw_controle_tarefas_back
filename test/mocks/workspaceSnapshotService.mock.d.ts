/**
 * Mock do WorkspaceSnapshotService para testes
 */
export function createWorkspaceSnapshotServiceMock(customizations?: {}): {
    takeSnapshot: jest.Mock<any, any, any>;
    getModifiedFiles: jest.Mock<any, any, any>;
    compareSnapshots: jest.Mock<any, any, any>;
};
