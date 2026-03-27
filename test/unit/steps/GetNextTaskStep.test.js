// test/unit/steps/GetNextTaskStep.test.js

const container = require('../../src/container');
const GetNextTaskStep = require('../../src/steps/GetNextTaskStep');

// Importar factories de mocks
const { createLoggerMock } = require('../mocks/logger.mock');
const { createAxiosMock } = require('../mocks/axios.mock');

describe('GetNextTaskStep', () => {
  let step;
  let mocks;
  
  const mockNickname = 'jarbas';
  const mockTask = {
    id: 'task-999',
    title: 'Tarefa de teste',
    description: 'Descrição da tarefa',
    assignedToId: 'user-123',
    status: 'pending'
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar config fresh para cada teste
    const mockConfig = {
      API_URL: 'http://localhost:3000'
    };
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      axios: createAxiosMock(),
      config: mockConfig
    };
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('config', mocks.config);
    // Não registramos axios no container porque o step aceita via options
    
    // Criar instância do step com axios mock injetado
    step = new GetNextTaskStep({
      axios: mocks.axios
    });
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve retornar tarefa quando API retorna tarefa válida', async () => {
      // Configurar axios para retornar tarefa
      mocks.axios.get.mockResolvedValueOnce({
        data: {
          task: mockTask
        }
      });
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter chamado API com URL correta
      expect(mocks.axios.get).toHaveBeenCalledWith(
        `http://localhost:3000/api/users/nickname/${mockNickname}/next-task`
      );
      
      // Deve ter logado sucesso
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining(`Buscando próxima tarefa elegível para usuário "${mockNickname}"`)
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining(`Tarefa ${mockTask.id} encontrada`)
      );
      
      // Resultado deve indicar sucesso com tarefa
      expect(result.nextTaskResult.success).toBe(true);
      expect(result.nextTaskResult.found).toBe(true);
      expect(result.nextTaskResult.task).toEqual(mockTask);
      expect(result.nextTaskResult.taskId).toBe(mockTask.id);
      
      // Tarefa deve estar no contexto
      expect(result.task).toEqual(mockTask);
    });
    
    it('deve retornar null quando API retorna 200 sem tarefa', async () => {
      // Configurar axios para retornar resposta vazia
      mocks.axios.get.mockResolvedValueOnce({
        data: {} // Sem task
      });
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado que não encontrou tarefa
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Nenhuma tarefa encontrada')
      );
      
      // Resultado deve indicar sucesso mas sem tarefa
      expect(result.nextTaskResult.success).toBe(true);
      expect(result.nextTaskResult.found).toBe(false);
      expect(result.nextTaskResult.task).toBeNull();
      expect(result.nextTaskResult.message).toContain('Nenhuma tarefa encontrada');
      
      // Não deve ter tarefa no contexto
      expect(result.task).toBeUndefined();
    });
    
    it('deve retornar null quando API retorna 404 (fila vazia)', async () => {
      // Configurar axios para lançar erro 404
      const error404 = {
        response: {
          status: 404,
          statusText: 'Not Found'
        },
        message: 'Not Found'
      };
      mocks.axios.get.mockRejectedValueOnce(error404);
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado que fila está vazia (não como erro)
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Nenhuma tarefa disponível')
      );
      expect(mocks.log).not.toHaveBeenCalledWith(
        expect.stringContaining('Erro ao buscar tarefa elegível')
      );
      
      // Resultado deve indicar sucesso mas sem tarefa
      expect(result.nextTaskResult.success).toBe(true);
      expect(result.nextTaskResult.found).toBe(false);
      expect(result.nextTaskResult.task).toBeNull();
      expect(result.nextTaskResult.apiStatus).toBe(404);
      expect(result.nextTaskResult.message).toContain('Fila vazia');
    });
    
    it('deve retornar null quando API retorna 204 (no content)', async () => {
      // Configurar axios para lançar erro 204
      const error204 = {
        response: {
          status: 204,
          statusText: 'No Content'
        },
        message: 'No Content'
      };
      mocks.axios.get.mockRejectedValueOnce(error204);
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado que fila está vazia
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Nenhuma tarefa disponível')
      );
      
      // Resultado deve indicar sucesso mas sem tarefa
      expect(result.nextTaskResult.success).toBe(true);
      expect(result.nextTaskResult.found).toBe(false);
      expect(result.nextTaskResult.apiStatus).toBe(204);
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando nickname não for fornecido', async () => {
      const context = {
        // nickname faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.nextTaskResult.success).toBe(false);
      expect(result.nextTaskResult.error).toContain('nickname não fornecido');
      expect(result.nextTaskResult.task).toBeNull();
    });
    
    it('deve usar apiUrl do contexto quando fornecido', async () => {
      // Configurar axios para retornar tarefa
      mocks.axios.get.mockResolvedValueOnce({
        data: {
          task: mockTask
        }
      });
      
      const customApiUrl = 'https://api.custom.com';
      const context = {
        nickname: mockNickname,
        apiUrl: customApiUrl
      };
      
      await step.execute(context);
      
      // Deve usar URL customizada, não a do config
      expect(mocks.axios.get).toHaveBeenCalledWith(
        `https://api.custom.com/api/users/nickname/${mockNickname}/next-task`
      );
    });
    
    it('deve usar apiUrl do config quando não fornecido no contexto', async () => {
      // Configurar axios para retornar tarefa
      mocks.axios.get.mockResolvedValueOnce({
        data: {
          task: mockTask
        }
      });
      
      const context = {
        nickname: mockNickname
        // sem apiUrl, usa config
      };
      
      await step.execute(context);
      
      // Deve usar URL do config
      expect(mocks.axios.get).toHaveBeenCalledWith(
        `http://localhost:3000/api/users/nickname/${mockNickname}/next-task`
      );
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve falhar quando API retorna erro diferente de 404/204', async () => {
      // Configurar axios para lançar erro 500
      const error500 = {
        response: {
          status: 500,
          statusText: 'Internal Server Error'
        },
        message: 'Server Error'
      };
      mocks.axios.get.mockRejectedValueOnce(error500);
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado como erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao buscar tarefa elegível na API')
      );
      
      // Resultado deve indicar falha
      expect(result.nextTaskResult.success).toBe(false);
      expect(result.nextTaskResult.error).toContain('Server Error');
      expect(result.nextTaskResult.task).toBeNull();
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve falhar quando há erro de rede', async () => {
      // Configurar axios para lançar erro de rede
      const networkError = new Error('Network Error');
      mocks.axios.get.mockRejectedValueOnce(networkError);
      
      const context = {
        nickname: mockNickname
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado como erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao buscar tarefa elegível na API')
      );
      
      // Resultado deve indicar falha
      expect(result.nextTaskResult.success).toBe(false);
      expect(result.nextTaskResult.error).toContain('Network Error');
    });
  });
  
  describe('método estático getNextTask', () => {
    it('deve funcionar corretamente via método estático', async () => {
      // Configurar axios para retornar tarefa
      mocks.axios.get.mockResolvedValueOnce({
        data: {
          task: mockTask
        }
      });
      
      // Para o método estático, precisamos registrar axios no container
      container.register('axios', mocks.axios);
      
      const result = await GetNextTaskStep.getNextTask(mockNickname);
      
      // Deve retornar resultado
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.task).toEqual(mockTask);
    });
    
    it('deve aceitar apiUrl customizado', async () => {
      // Configurar axios para retornar tarefa
      mocks.axios.get.mockResolvedValueOnce({
        data: {
          task: mockTask
        }
      });
      
      container.register('axios', mocks.axios);
      
      const customApiUrl = 'https://api.custom.com';
      await GetNextTaskStep.getNextTask(mockNickname, customApiUrl);
      
      // Deve ter usado URL customizada
      expect(mocks.axios.get).toHaveBeenCalledWith(
        `https://api.custom.com/api/users/nickname/${mockNickname}/next-task`
      );
    });
  });
});