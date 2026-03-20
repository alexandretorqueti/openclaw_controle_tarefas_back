// test/integration/legacyExecuteTask.integration.test.js
const { executeTask } = require('../../src/steps/adapters/legacyExecuteTask');
const TaskExecutionOrchestrator = require('../../src/steps/TaskExecutionOrchestrator');
const container = require('../../src/container');

describe('legacyExecuteTask Adapter Integration', () => {
  let executeTaskSpy;

  beforeAll(() => {
    // Registrar log no container para evitar erros no construtor
    if (!container.registry.has('log')) {
      container.register('log', jest.fn().mockResolvedValue());
    }
  });

  beforeEach(() => {
    // Usamos spyon no prototype da classe original
    executeTaskSpy = jest.spyOn(TaskExecutionOrchestrator.prototype, 'executeTask')
      .mockResolvedValue({
        success: true,
        executionNotes: 'Pipeline completo com sucesso',
        taskId: 'task-999'
      });
  });
  
  afterEach(() => {
    jest.restoreAllMocks();
  });
  
  it('deve instanciar o orchestrator e retornar seu resultado', async () => {
    const mockTask = { id: 'task-999', title: 'Test integration' };
    const mockUserId = 'user-jarbas';
    const mockConfig = { TASKS_DIR: '/tmp/tasks' };
    
    const result = await executeTask(mockTask, mockUserId, mockConfig);
    
    expect(executeTaskSpy).toHaveBeenCalledTimes(1);
    expect(executeTaskSpy).toHaveBeenCalledWith(mockTask, mockUserId, mockConfig);
    expect(result).toEqual({
      success: true,
      executionNotes: 'Pipeline completo com sucesso',
      taskId: 'task-999'
    });
  });
});