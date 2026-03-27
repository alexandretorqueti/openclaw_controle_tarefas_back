const TaskExecutionOrchestrator = require('../../src/steps/TaskExecutionOrchestrator');

// --- 1. MOCKS DOS STEPS ---
// Importamos os steps para poder manipular seus mocks dentro dos testes
const SetupContextStep = require('../../src/steps/SetupContextStep');
const ArchitectPlanningStep = require('../../src/steps/ArchitectPlanningStep');
const DeveloperLoopOrchestrator = require('../../src/steps/DeveloperLoopOrchestrator');
const TeardownStep = require('../../src/steps/TeardownStep');

jest.mock('../../src/steps/SetupContextStep');
jest.mock('../../src/steps/ArchitectPlanningStep');
jest.mock('../../src/steps/DeveloperLoopOrchestrator');
jest.mock('../../src/steps/TeardownStep');

// Mock do container
jest.mock('../../src/container', () => ({
  resolve: jest.fn((name) => {
    if (name === 'log') return jest.fn().mockResolvedValue();
    return {};
  })
}));

describe('TaskExecutionOrchestrator', () => {
  let mockLog;
  let defaultTask, defaultUser, defaultConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLog = jest.fn().mockResolvedValue();
    
    // Configuração padrão de SUCESSO para todos os mocks
    // Isso evita que um teste quebre porque o step anterior não foi definido
    SetupContextStep.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, someData: 'context' })
    }));
    
    ArchitectPlanningStep.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, plan: 'architect-plan' })
    }));
    
    DeveloperLoopOrchestrator.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, contractResult: { contractFulfilled: true } })
    }));
    
    TeardownStep.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ 
        success: true, 
        finalResult: { success: true, executionNotes: 'Concluído com sucesso' } 
      })
    }));

    defaultTask = { id: 'task-999', title: 'Tarefa Mestre' };
    defaultUser = 'user-admin';
    defaultConfig = { API_URL: 'http://test.com' };
  });

  const createOrchestrator = () => new TaskExecutionOrchestrator({ log: mockLog });

  // --- CENÁRIOS DE TESTE ---

  it('1. Caminho Feliz: Deve executar todos os steps e retornar sucesso', async () => {
    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeTask(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(true);
    expect(result.executionNotes).toBe('Concluído com sucesso');
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Tarefa task-999 concluída: SUCESSO'));
  });

  it('2. Abort no Setup: Deve interromper o fluxo se o SetupContextStep falhar', async () => {
    // Sobrescrevemos apenas o Setup para este teste
    SetupContextStep.mockImplementationOnce(() => ({
      execute: jest.fn().mockResolvedValue({ 
        shouldAbort: true, 
        abortReason: 'Pasta não encontrada' 
      })
    }));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeTask(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(false);
    expect(result.executionNotes).toContain('Setup abortado: Pasta não encontrada');
  });

  it('3. Abort no Arquiteto: Deve interromper se o planejamento falhar', async () => {
    // Setup funciona (padrão do beforeEach), Arquiteto falha
    ArchitectPlanningStep.mockImplementationOnce(() => ({
      execute: jest.fn().mockResolvedValue({ 
        shouldAbort: true, 
        abortReason: 'IA não gerou plano' 
      })
    }));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeTask(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(false);
    expect(result.executionNotes).toContain('Arquitetura abortada');
    // Verifica se o log de abort foi chamado
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Arquitetura abortada'));
  });

  it('4. Abort no Desenvolvedor: Deve interromper se o loop estagnar', async () => {
    // Setup e Arquiteto funcionam (padrão), Desenvolvedor falha
    DeveloperLoopOrchestrator.mockImplementationOnce(() => ({
      execute: jest.fn().mockResolvedValue({ 
        shouldAbort: true, 
        abortReason: 'Estagnação detectada' 
      })
    }));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeTask(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(false);
    expect(result.executionNotes).toContain('Loop do desenvolvedor abortado');
  });

  it('5. Falha Fatal: Deve capturar exceções não tratadas e retornar erro amigável', async () => {
    SetupContextStep.mockImplementationOnce(() => ({
      execute: jest.fn().mockRejectedValue(new Error('Crash de Memória'))
    }));

    const orchestrator = createOrchestrator();
    const result = await orchestrator.executeTask(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(false);
    expect(result.executionNotes).toContain('Falha crítica no pipeline: Crash de Memória');
  });

  it('6. Caso Estático: Deve funcionar corretamente via método estático execute', async () => {
    const spy = jest.spyOn(TaskExecutionOrchestrator.prototype, 'executeTask').mockResolvedValue({
      success: true,
      taskId: 'static-task'
    });

    const result = await TaskExecutionOrchestrator.execute(defaultTask, defaultUser, defaultConfig);

    expect(result.success).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});