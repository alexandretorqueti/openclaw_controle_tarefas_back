// test/integration/legacyGetNextTask.integration.test.js
/**
 * Teste de integração que demonstra a compatibilidade do novo GetNextTaskStep
 * com a função getNextEligibleTask original usando container.
 */

const container = require('../../src/container');
const { createLegacyGetNextTask } = require('../../src/steps/adapters/legacyGetNextTask');

// Importar factories de mocks
const { createLoggerMock } = require('../mocks/logger.mock');
const { createAxiosMock } = require('../mocks/axios.mock');

describe('Integração: legacyGetNextTask', () => {
  let getNextEligibleTask;
  let mocks;
  let defaultApiUrl;
  
  const mockNickname = 'jarbas';
  const mockTask = {
    id: 'task-integration-123',
    title: 'Tarefa de integração',
    description: 'Descrição',
    assignedToId: 'user-1'
  };
  
  beforeEach(() => {
    // Limpar container
    container.clear();
    
    // Criar mocks
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock()
    };
    
    defaultApiUrl = 'http://localhost:3000';
    
    const mockConfig = {
      API_URL: defaultApiUrl
    };
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('axios', mocks.axios);
    container.register('config', mockConfig);
    
    // Criar função getNextEligibleTask usando o adapter
    getNextEligibleTask = createLegacyGetNextTask(defaultApiUrl);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  it('deve retornar tarefa quando API retorna tarefa válida', async () => {
    // Configurar axios para retornar tarefa
    mocks.axios.get.mockResolvedValueOnce({
      data: {
        task: mockTask
      }
    });
    
    const task = await getNextEligibleTask(mockNickname);
    
    // Deve ter chamado API
    expect(mocks.axios.get).toHaveBeenCalledWith(
      `${defaultApiUrl}/api/users/nickname/${mockNickname}/next-task`
    );
    
    // Deve retornar a tarefa (mesma assinatura da função original)
    expect(task).toEqual(mockTask);
  });
  
  it('deve retornar null quando API retorna 404 (fila vazia)', async () => {
    // Configurar axios para lançar erro 404
    const error404 = {
      response: {
        status: 404
      },
      message: 'Not Found'
    };
    mocks.axios.get.mockRejectedValueOnce(error404);
    
    const task = await getNextEligibleTask(mockNickname);
    
    // Deve retornar null (mesmo comportamento da função original)
    expect(task).toBeNull();
    
    // Deve ter logado que fila está vazia
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Nenhuma tarefa disponível')
    );
  });
  
  it('deve retornar null quando API retorna 204 (no content)', async () => {
    // Configurar axios para lançar erro 204
    const error204 = {
      response: {
        status: 204
      },
      message: 'No Content'
    };
    mocks.axios.get.mockRejectedValueOnce(error204);
    
    const task = await getNextEligibleTask(mockNickname);
    
    expect(task).toBeNull();
  });
  
  it('deve retornar null quando API retorna erro diferente de 404/204', async () => {
    // Configurar axios para lançar erro 500
    const error500 = {
      response: {
        status: 500
      },
      message: 'Server Error'
    };
    mocks.axios.get.mockRejectedValueOnce(error500);
    
    const task = await getNextEligibleTask(mockNickname);
    
    // Deve retornar null (mesmo comportamento da função original)
    expect(task).toBeNull();
    
    // Deve ter logado erro
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Erro ao buscar tarefa elegível')
    );
  });
  
  it('deve manter a mesma assinatura da função original', () => {
    // A função deve aceitar um parâmetro (nickname)
    expect(getNextEligibleTask).toBeInstanceOf(Function);
    expect(getNextEligibleTask.length).toBe(1);
    
    // Deve retornar uma Promise<Object|null>
    const returnValue = getNextEligibleTask(mockNickname);
    expect(returnValue).toBeInstanceOf(Promise);
    
    // A Promise deve resolver com objeto ou null
    return returnValue.then(result => {
      expect(result === null || typeof result === 'object').toBe(true);
    });
  });
  
  it('deve funcionar sem apiUrl padrão', async () => {
    // Criar adapter sem parâmetro
    const getNextEligibleTaskSemDefault = createLegacyGetNextTask();
    
    // Configurar axios para retornar tarefa
    mocks.axios.get.mockResolvedValueOnce({
      data: {
        task: mockTask
      }
    });
    
    const task = await getNextEligibleTaskSemDefault(mockNickname);
    
    // Deve ter usado URL do config
    expect(mocks.axios.get).toHaveBeenCalledWith(
      `${defaultApiUrl}/api/users/nickname/${mockNickname}/next-task`
    );
    expect(task).toEqual(mockTask);
  });
  
  describe('comportamento igual à função original', () => {
    it('não deve lançar exceções (sempre retorna null ou objeto)', async () => {
      // Configurar erro grave
      mocks.axios.get.mockRejectedValueOnce(new Error('Erro grave'));
      
      // Não deve lançar exceção
      await expect(getNextEligibleTask(mockNickname)).resolves.not.toThrow();
      
      // Deve retornar null
      const result = await getNextEligibleTask(mockNickname);
      expect(result).toBeNull();
    });
    
    it('deve lidar com nickname vazio/inválido', async () => {
      // A função original não valida nickname vazio na assinatura
      // O step vai validar e retornar null
      const task = await getNextEligibleTask('');
      
      expect(task).toBeNull();
    });
  });
});