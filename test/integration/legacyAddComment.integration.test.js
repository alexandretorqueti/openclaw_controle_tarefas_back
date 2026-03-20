// test/integration/legacyAddComment.integration.test.js
/**
 * Teste de integração que demonstra a compatibilidade do novo AddCommentStep
 * com a função addComment original usando container.
 */

const container = require('../../src/container');
const { createLegacyAddComment } = require('../../src/steps/adapters/legacyAddComment');

// Importar factories de mocks
const { createCommentServiceMock } = require('../mocks/commentService.mock');
const { createLoggerMock } = require('../mocks/logger.mock');

describe('Integração: legacyAddComment', () => {
  let addComment;
  let mocks;
  let defaultUserId;
  
  beforeEach(() => {
    // Limpar container
    container.clear();
    
    // Criar mocks
    mocks = {
      commentService: createCommentServiceMock(),
      log: createLoggerMock()
    };
    
    defaultUserId = 'user-jarbas-123';
    
    // Registrar mocks no container
    container.register('commentService', mocks.commentService);
    container.register('log', mocks.log);
    
    // Criar função addComment usando o adapter
    addComment = createLegacyAddComment(defaultUserId);
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  it('deve adicionar comentário com userId padrão', async () => {
    await addComment('task-123', 'Comentário de teste');
    
    expect(mocks.commentService.createComment).toHaveBeenCalledWith({
      taskId: 'task-123',
      userId: 'user-jarbas-123',
      content: 'Comentário de teste'
    });
    
    // Deve ter logado sucesso
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Comentário adicionado à tarefa task-123')
    );
  });
  
  it('deve lidar com erros silenciosamente (como a função original)', async () => {
    // Configurar falha
    mocks.commentService.createComment.mockRejectedValueOnce(
      new Error('Falha no banco')
    );
    
    // A função não deve lançar exceção
    await expect(addComment('task-123', 'Comentário com erro')).resolves.not.toThrow();
    
    // Deve ter logado o erro
    expect(mocks.log).toHaveBeenCalledWith(
      expect.stringContaining('Erro ao adicionar comentário à tarefa task-123')
    );
  });
  
  it('deve manter a mesma assinatura da função original', () => {
    // A função deve aceitar dois parâmetros (taskId, content)
    expect(addComment).toBeInstanceOf(Function);
    expect(addComment.length).toBe(2);
    
    // Deve retornar uma Promise<void>
    const returnValue = addComment('task-123', 'teste');
    expect(returnValue).toBeInstanceOf(Promise);
    
    // A Promise deve resolver sem valor (void)
    return returnValue.then(result => {
      expect(result).toBeUndefined();
    });
  });
  
  it('deve funcionar sem userId padrão (null)', async () => {
    // Criar adapter sem userId padrão
    const addCommentSemUserId = createLegacyAddComment();
    
    await addCommentSemUserId('task-456', 'Comentário sem userId');
    
    expect(mocks.commentService.createComment).toHaveBeenCalledWith({
      taskId: 'task-456',
      userId: null,
      content: 'Comentário sem userId'
    });
  });
  
  describe('comportamento igual à função original', () => {
    it('não deve lançar exceções (apenas logar)', async () => {
      mocks.commentService.createComment.mockRejectedValue(
        new Error('Erro grave')
      );
      
      // A função original não lança exceção, apenas loga
      await expect(addComment('task-999', 'teste')).resolves.not.toThrow();
      
      // Mas deve ter logado o erro
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Erro ao adicionar comentário')
      );
    });
    
    it('deve funcionar mesmo com parâmetros inválidos (o step valida)', async () => {
      // O adapter não valida parâmetros, o step sim
      // Mas a função original também não valida explicitamente
      await expect(addComment(null, 'teste')).resolves.not.toThrow();
    });
  });
});