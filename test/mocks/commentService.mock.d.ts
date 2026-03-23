/**
 * Mock do CommentService para testes
 */
export function createCommentServiceMock(customizations?: {}): {
    createComment: jest.Mock<any, any, any>;
    getCommentsByTaskId: jest.Mock<any, any, any>;
};
