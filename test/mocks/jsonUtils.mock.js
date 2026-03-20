// test/mocks/jsonUtils.mock.js

/**
 * Mock do JsonUtils para testes
 */
function createJsonUtilsMock(customizations = {}) {
  const mock = {
    extractJsonObjects: jest.fn(),
    ...customizations
  };
  
  mock.extractJsonObjects.mockImplementation((text) => {
    // Tenta extrair JSON do texto
    const match = text.match(/\[[\s\S]*?\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  
  return mock;
}

module.exports = { createJsonUtilsMock };