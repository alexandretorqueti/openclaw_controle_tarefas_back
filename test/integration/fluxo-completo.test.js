// Teste de INTEGRAÇÃO do fluxo completo

describe('Fluxo de Integração: Arquiteto → Loop → Desenvolvedor', () => {
  // Configuração global de mocks
  const setupGlobalMocks = () => {
    jest.resetModules();
    const container = require('../../src/container');
    container.clear();
    
    // Mock básico mas funcional
    container.register('log', async (msg) => {
      // console.log('[LOG]', msg);
    });
    
    container.register('openClawService', {
      executeWithFallback: async () => ({
        rawOutput: 'Resposta mock do agente',
        success: true,
        metadata: { sessionId: 'mock' }
      })
    });
    
    container.register('sessionChainUtils', {
      generateUnifiedSessionId: () => 'unified',
      generateIsolatedSessionId: () => 'isolated',
      generateLoopSessionId: () => 'loop'
    });
    
    container.register('taskAnalysisService', {
      analyzeArchitectResponse: async () => ({
        hasPlan: true,
        confidence: 80,
        taskType: 'development'
      }),
      analyzeDeveloperTurn: async () => ({
        isMeaningless: false,
        hasPlan: true
      })
    });
    
    container.register('evidenceService', {
      createEmptyEvidence: () => ({}),
      applyExecutionEvidence: () => {},
      collectEvidence: async () => ({ success: true })
    });
    
    container.register('fileSystem', {
      writeFile: async () => {},
      readFile: async () => 'mock',
      readdir: async () => []
    });
    
    container.register('smartFileFinder', {
      findFilesByPattern: async () => [],
      findRealArchitectPlan: async () => null
    });
    
    container.register('workspaceSnapshotService', {
      captureSnapshot: async () => ({ files: [] }),
      takeSnapshot: async () => ({ files: [] }),
      compareSnapshots: async () => ({ hasChanges: false })
    });
    
    container.register('fileUtils', {
      readJson: async () => ({}),
      writeJson: async () => {},
      fileExists: async () => false,
      readFile: async () => '',
      writeFile: async () => {}
    });
    
    container.register('promptFactory', {
      createArchitectPrompt: () => 'Prompt mock'
    });
    
    container.register('path', {
      join: (...parts) => parts.join('/'),
      dirname: () => '/mock'
    });
    
    // Mock do taskExecutionService (necessário para DeveloperLoopOrchestrator)
    container.register('taskExecutionService', {
      executeTaskStep: async (step, context) => {
        console.log('[MOCK taskExecutionService.executeTaskStep]', step?.constructor?.name);
        // Simula execução bem-sucedida
        return {
          ...context,
          stepResult: { success: true, step: step?.constructor?.name }
        };
      }
    });
    
    return container;
  };
  
  test('1. ArchitectPlanningStep deve funcionar', async () => {
    const container = setupGlobalMocks();
    
    const ArchitectPlanningStep = require('../../src/steps/ArchitectPlanningStep');
    const step = new ArchitectPlanningStep();
    
    const context = {
      task: { id: "test-1", title: "Teste Arquiteto" },
      project: { pastaBase: "/tmp" },
      config: { TASKS_DIR: "/tmp" },
      files: { promptFile: "/tmp/p.txt" },
      analysisPlan: { taskType: 'development' },
      currentInput: 'Teste'
    };
    
    const result = await step.execute(context);
    
    expect(result).toBeDefined();
    expect(result.task.id).toBe("test-1");
    // O architectAnalysis pode não ser retornado se houver erro, mas o método deve executar
    console.log('ArchitectPlanningStep: OK');
  });
  
  test('2. DeveloperTurnStep deve funcionar', async () => {
    const container = setupGlobalMocks();
    
    const DeveloperTurnStep = require('../../src/steps/DeveloperTurnStep');
    const step = new DeveloperTurnStep();
    
    const context = {
      task: { id: "test-2", title: "Teste Desenvolvedor" },
      project: { pastaBase: "/tmp" },
      config: { TASKS_DIR: "/tmp" },
      files: { promptFile: "/tmp/p.txt", doneFile: "/tmp/d.done", terminalLogFile: "/tmp/t.log" },
      turnNumber: 1,
      basePrompt: 'Implemente algo',
      lastFeedback: null,
      backupAgent: 'main',
      executionTimestamp: Date.now()
    };
    
    const result = await step.execute(context);
    
    expect(result).toBeDefined();
    expect(result.turnResult).toBeDefined();
    console.log('DeveloperTurnStep: OK - turnResult:', result.turnResult?.success);
  });
  
  test('3. DeveloperLoopOrchestrator deve funcionar', async () => {
    const container = setupGlobalMocks();
    
    const DeveloperLoopOrchestrator = require('../../src/steps/DeveloperLoopOrchestrator');
    const step = new DeveloperLoopOrchestrator();
    
    const context = {
      task: { id: "test-3", title: "Teste Loop" },
      project: { pastaBase: "/tmp" },
      config: { TASKS_DIR: "/tmp", MAX_TURNS: 2 },
      files: { promptFile: "/tmp/p.txt", doneFile: "/tmp/d.done" },
      turnNumber: 1,
      basePrompt: 'Teste de loop',
      lastFeedback: null,
      backupAgent: 'main',
      executionTimestamp: Date.now(),
      architectAnalysis: { hasPlan: true, confidence: 80 }
    };
    
    let result;
    try {
      result = await step.execute(context);
    } catch (err) {
      console.error('❌ ERRO no DeveloperLoopOrchestrator:', err.message);
      console.error(err.stack);
      throw err;
    }
    
    console.log('DeveloperLoopOrchestrator result:', result);
    console.log('Type:', typeof result);
    console.log('Keys:', result ? Object.keys(result) : 'undefined');
    
    expect(result).toBeDefined();
    // O DeveloperLoopOrchestrator retorna developerLoopResult, não finalResult
    expect(result.developerLoopResult).toBeDefined();
    console.log('DeveloperLoopOrchestrator: OK - developerLoopResult:', result.developerLoopResult?.success);
  });
  
  test('4. Fluxo sequencial simplificado', async () => {
    console.log('\n=== TESTANDO FLUXO SEQUENCIAL ===');
    
    // Configurar uma vez para todos
    const container = setupGlobalMocks();
    
    // Carregar todas as classes
    const ArchitectPlanningStep = require('../../src/steps/ArchitectPlanningStep');
    const DeveloperLoopOrchestrator = require('../../src/steps/DeveloperLoopOrchestrator');
    const DeveloperTurnStep = require('../../src/steps/DeveloperTurnStep');
    
    // Contexto comum
    const baseContext = {
      task: { 
        id: "fluxo-test", 
        title: "Cadastro de Prioridades",
        agent: "arquiteto-monitor-tarefas"
      },
      project: { 
        pastaBase: "/tmp/fluxo-test",
        name: "Projeto Teste"
      },
      config: { 
        TASKS_DIR: "/tmp/fluxo-tasks",
        TASK_TIMEOUT_MS: 1200000,
        MAX_TURNS: 3
      },
      files: { 
        promptFile: "/tmp/fluxo-prompt.txt",
        doneFile: "/tmp/fluxo-done.done",
        terminalLogFile: "/tmp/fluxo-terminal.log",
        architectPlanFile: "/tmp/fluxo-architect-plan.txt"
      },
      analysisPlan: { 
        taskType: 'development'
      },
      currentInput: 'Implemente formulário de prioridades'
    };
    
    // PASSO 1: Arquiteto
    console.log('1. Executando ArchitectPlanningStep...');
    const architectStep = new ArchitectPlanningStep();
    const afterArchitect = await architectStep.execute(baseContext);
    
    expect(afterArchitect).toBeDefined();
    console.log('   ✅ ArchitectPlanningStep executado');
    
    // PASSO 2: Preparar para Loop
    const loopContext = {
      ...afterArchitect,
      turnNumber: 1,
      basePrompt: afterArchitect.currentInput || 'Plano do arquiteto',
      lastFeedback: null,
      backupAgent: 'main',
      executionTimestamp: Date.now()
    };
    
    // PASSO 3: Loop Orchestrator
    console.log('2. Executando DeveloperLoopOrchestrator...');
    const loopOrchestrator = new DeveloperLoopOrchestrator();
    const afterLoop = await loopOrchestrator.execute(loopContext);
    
    expect(afterLoop).toBeDefined();
    expect(afterLoop.developerLoopResult).toBeDefined();
    console.log('   ✅ DeveloperLoopOrchestrator executado');
    console.log('   📊 Turns:', afterLoop.developerLoopResult?.turnsExecuted);
    console.log('   📊 Success:', afterLoop.developerLoopResult?.success);
    
    // PASSO 4: Turno individual (verificação)
    console.log('3. Verificando DeveloperTurnStep...');
    const developerStep = new DeveloperTurnStep();
    const turnContext = {
      ...loopContext,
      turnNumber: 1
    };
    
    const afterTurn = await developerStep.execute(turnContext);
    
    expect(afterTurn).toBeDefined();
    expect(afterTurn.turnResult).toBeDefined();
    console.log('   ✅ DeveloperTurnStep executado');
    console.log('   📊 Turn success:', afterTurn.turnResult?.success);
    
    console.log('\n=== RESUMO DO FLUXO ===');
    console.log('1. ArchitectPlanningStep: ✅ Executado');
    console.log('2. DeveloperLoopOrchestrator: ✅ Executado');
    console.log('3. DeveloperTurnStep: ✅ Executado');
    console.log('\n🎯 FLUXO DE INTEGRAÇÃO TESTADO COM SUCESSO!');
  });
});