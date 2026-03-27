const AddCommentStep = require('../../src/steps/AddCommentStep'); // Ajuste o caminho

describe('AddCommentStep', () => {
  let mockLog, mockCommentService;
  let defaultContext;

  beforeEach(() => {
    jest.clearAllMocks();

    mockLog = jest.fn().mockResolvedValue();
    
    mockCommentService = {
      createComment: jest.fn().mockResolvedValue({ id: 'comment-123' })
    };

    defaultContext = {
      taskId: 'task-123',
      content: 'Este é um comentário de teste gerado pelo sistema',
      userId: 'user-456'
    };
  });

  const createStep = () => new AddCommentStep({
    log: mockLog,
    commentService: mockCommentService
  });

  // --- CENÁRIOS DE TESTE ---

  it('1. Deve abortar se taskId ou content não forem fornecidos', async () => {
    const step = createStep();
    
    // Passando um contexto sem 'content'
    const result = await step.execute({ taskId: 'task-123' }); 

    expect(result.commentResult.success).toBe(false);
    expect(result.commentResult.error).toContain('taskId ou content não fornecidos');
    
    // Garante que o serviço de banco de dados não foi chamado atoa
    expect(mockCommentService.createComment).not.toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('taskId ou content não fornecidos'));
  });

  it('2. Fluxo Normal: Deve adicionar comentário com sucesso', async () => {
    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.commentResult.success).toBe(true);
    expect(result.commentResult.taskId).toBe('task-123');
    expect(result.commentResult.content).toBe(defaultContext.content);
    
    // Verifica se os parâmetros foram montados corretamente para o serviço
    expect(mockCommentService.createComment).toHaveBeenCalledWith({
      taskId: 'task-123',
      userId: 'user-456',
      content: defaultContext.content
    });
    
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Comentário adicionado à tarefa task-123'));
  });

  it('3. Fluxo Alternativo: Deve lidar perfeitamente com usuário nulo (userId opcional)', async () => {
    const step = createStep();
    
    // Contexto sem a propriedade userId
    const ctxSemUser = { taskId: 'task-123', content: 'Comentário anônimo' };
    await step.execute(ctxSemUser);

    expect(mockCommentService.createComment).toHaveBeenCalledWith({
      taskId: 'task-123',
      userId: null, // Deve forçar o null conforme a regra de negócio
      content: 'Comentário anônimo'
    });
  });

  it('4. Tratamento de Erro: Deve capturar falhas no serviço de comentários e logar', async () => {
    // Força o banco de dados/serviço a rejeitar a requisição
    mockCommentService.createComment.mockRejectedValueOnce(new Error('Banco de dados indisponível'));

    const step = createStep();
    const result = await step.execute(defaultContext);

    expect(result.commentResult.success).toBe(false);
    expect(result.commentResult.error).toBe('Banco de dados indisponível');
    expect(result.commentResult.taskId).toBe('task-123');
    
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Erro ao adicionar comentário à tarefa task-123'));
  });
});