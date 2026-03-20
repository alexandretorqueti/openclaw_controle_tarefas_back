// test/mocks/axios.mock.js

/**
 * Mock do Axios para testes
 */
function createAxiosMock(customizations = {}) {
  const mock = {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    ...customizations
  };
  
  // Implementações padrão
  mock.get.mockResolvedValue({ data: { users: [] } });
  mock.post.mockResolvedValue({ data: { success: true } });
  mock.put.mockResolvedValue({ data: { success: true } });
  mock.patch.mockResolvedValue({ data: { success: true } });
  
  return mock;
}

module.exports = { createAxiosMock };