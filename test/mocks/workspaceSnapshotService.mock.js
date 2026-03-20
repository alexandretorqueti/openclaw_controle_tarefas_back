// test/mocks/workspaceSnapshotService.mock.js

/**
 * Mock do WorkspaceSnapshotService para testes
 */
function createWorkspaceSnapshotServiceMock(customizations = {}) {
  const mock = {
    takeSnapshot: jest.fn(),
    getModifiedFiles: jest.fn(),
    compareSnapshots: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.takeSnapshot.mockResolvedValue(new Map([
    ['/tmp/project/file1.js', 1234567890],
    ['/tmp/project/file2.js', 1234567890],
    ['/tmp/project/package.json', 1234567890]
  ]));
  
  mock.getModifiedFiles.mockResolvedValue([]);
  
  mock.compareSnapshots.mockReturnValue({
    modified: [],
    created: [],
    deleted: []
  });
  
  return mock;
}

module.exports = { createWorkspaceSnapshotServiceMock };