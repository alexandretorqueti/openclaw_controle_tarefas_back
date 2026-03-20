// test/mocks/commentService.mock.js

/**
 * Mock do CommentService para testes
 */
function createCommentServiceMock(customizations = {}) {
  const mock = {
    createComment: jest.fn(),
    getCommentsByTaskId: jest.fn(),
    ...customizations
  };
  
  mock.createComment.mockImplementation(async (commentData) => {
    return {
      id: `comment-${Date.now()}`,
      ...commentData,
      createdAt: new Date().toISOString()
    };
  });
  
  return mock;
}

module.exports = { createCommentServiceMock };