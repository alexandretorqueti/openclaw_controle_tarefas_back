// test/unit/steps/AddCommentStep.test.js

const container = require('../../src/container');
const AddCommentStep = require('../../src/steps/AddCommentStep');

// Importar factories de mocks
const { createCommentServiceMock } = require('../mocks/commentService.mock');
const { createLoggerMock } = require('../mocks/logger.mock');

describe('AddCommentStep', () => {
  let step;
  let mocks;
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar mocks
    mocks = {
      commentService: createCommentServiceMock(),
      log: createLoggerMock()
    };
    
    // Registrar mocks no container
    container.register('commentService', mocks.commentService);
    container.register('log', mocks.log);
    
    // Criar instância do step
    step = new AddCommentStep();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve adicionar comentário com sucesso', async () => {
      const context = {
        taskId: 'task-123',
        content: 'Comentário de teste',
        userId: 'user-456'
      };
      
      const result = await step.execute(context);
      
      // Verificar que commentService foi chamado corretamente
      expect(mocks.commentService.createComment).toHaveBeenCalledWith({
        taskId: 'task-123',
        userId: 'user-456',
        content: 'Comentário de teste'
      });
      
      // Verificar que log foi chamado
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Comentário adicionado à tarefa task-123')
      );
      
      // Verificar resultado
      expect(result.commentResult.success).toBe(true);
      expect(result.commentResult.taskId).toBe('task-123');
      expect(result.commentResult.content).toBe('Comentário de teste');
    });
    
    it('deve usar userId null quando não fornecido', async () => {
      const context = {
        taskId: 'task-123',
        content: 'Comentário sem userId'
      };
      
      await step.execute(context);
      
      expect(mocks.commentService.createComment).toHaveBeenCalledWith({
        taskId: 'task-123',
        userId: null,
        content: 'Comentário sem userId'
      });
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando taskId não for fornecido', async () => {
      const context = {
        content: 'Comentário sem taskId'
        // taskId faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.commentResult.success).toBe(false);
      expect(result.commentResult.error).toContain('taskId ou content não fornecidos');
      expect(mocks.commentService.createComment).not.toHaveBeenCalled();
    });
    
    it('deve falhar quando content não for fornecido', async () => {
      const context = {
        taskId: 'task-123'
        // content faltando
      };
      
      const result = await step.execute(context);
      
      expect(result.commentResult.success).toBe(false);
      expect(result.commentResult.error).toContain('taskId ou content não fornecidos');
      expect(mocks.commentService.createComment).not.toHaveBeenCalled();
    });
    
    it('deve falhar quando ambos taskId e content não forem fornecidos', async () => {
      const context = {};
      
      const result = await step.execute(context);
      
      expect(result.commentResult.success).toBe(false);
      expect(result.commentResult.error).toContain('taskId ou content não fornecidos');
      expect(mocks.commentService.createComment).not.toHaveBeenCalled();
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com erro do commentService', async () => {
      // Configurar mock para lançar erro
      mocks.commentService.createComment.mockRejectedValueOnce(
        new Error('Falha no banco de dados')
      );
      
      const context = {
        taskId: 'task-123',
        content: 'Comentário que falhará',
        userId: 'user-456'
      };
      
      const result = await step.execute(context);
      
      // Verificar que log de erro foi chamado
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao adicionar comentário à tarefa task-123')
      );
      
      // Verificar resultado de erro
      expect(result.commentResult.success).toBe(false);
      expect(result.commentResult.error).toContain('Falha no banco de dados');
      expect(result.commentResult.taskId).toBe('task-123');
    });
  });
  
  describe('método estático addComment', () => {
    it('deve funcionar corretamente via método estático', async () => {
      const result = await AddCommentStep.addComment('task-999', 'Teste estático', 'user-888');
      
      expect(mocks.commentService.createComment).toHaveBeenCalledWith({
        taskId: 'task-999',
        userId: 'user-888',
        content: 'Teste estático'
      });
      
      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-999');
    });
    
    it('deve lidar com erros via método estático', async () => {
      mocks.commentService.createComment.mockRejectedValueOnce(
        new Error('Erro estático')
      );
      
      const result = await AddCommentStep.addComment('task-999', 'Teste erro');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Erro estático');
    });
  });
});