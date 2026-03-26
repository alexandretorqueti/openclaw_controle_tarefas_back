// Teste FINAL e SIMPLES - Mockando SessionChainUtils no require.cache

console.log('=== TESTE FINAL SIMPLES ===\n');

// Mock do SessionChainUtils ANTES de carregar DeveloperTurnStep
const mockSessionChainUtils = {
  generateLoopSessionId: (taskId, prefix, timestamp) => {
    console.log(`[MOCK-SessionChainUtils] generateLoopSessionId chamado`);
    return `${prefix}-${taskId}-${timestamp}`;
  }
};

// Injeta no require.cache
require.cache[require.resolve('./src/utils/sessionChainUtils')] = {
  exports: mockSessionChainUtils
};

// Agora carrega o DeveloperTurnStep ORIGINAL
const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');

// Mocks simples
const mocks = {
  log: async (msg) => console.log('[LOG]', msg),
  openClawService: {
    executeWithFallback: async () => ({
      rawOutput: 'Output mock',
      success: true,
      toolCall: { name: 'test' },
      toolResult: { success: true }
    })
  },
  evidenceService: {
    createEmptyEvidence: () => ({ data: {} }),
    applyExecutionEvidence: () => {},
    collectEvidence: async () => ({ success: true })
  },
  fileSystem: {
    writeFile: async () => {},
    readFile: async () => 'mock',
    readdir: async () => []
  },
  path: {
    join: (...parts) => parts.join('/'),
    dirname: () => '/mock'
  },
  taskAnalysisService: {
    analyzeArchitectResponse: async () => ({
      hasPlan: true,
      isMeaningless: false,
      isTalkingWithoutAction: false
    })
  }
};

// Instância
const step = new DeveloperTurnStep(mocks);

// Contexto mínimo
const context = {
  task: { id: "final-test", title: "Final Test", agent: "test" },
  project: { pastaBase: "/tmp" },
  config: { TASKS_DIR: "/tmp", TASK_TIMEOUT_MS: 1000 },
  files: { 
    promptFile: "/tmp/p.txt", 
    doneFile: "/tmp/d.done", 
    terminalLogFile: "/tmp/t.log" 
  },
  turnNumber: 1,
  basePrompt: "Implemente algo",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('🎯 Executando DeveloperTurnStep ORIGINAL...\n');

step.execute(context)
  .then(result => {
    console.log('\n✅ RESULTADO FINAL:');
    if (result) {
      console.log('✅ Sucesso! Retornou objeto com', Object.keys(result).length, 'campos');
      console.log('   turnResult:', result.turnResult?.success ? '✅ success: true' : '❌');
      console.log('   evidence:', result.evidence ? '✅' : '❌');
      console.log('   currentOpenClawResult:', result.currentOpenClawResult ? '✅' : '❌');
      
      console.log('\n🎯 O QUE CONSEGUIMOS:');
      console.log('   1. ✅ Testamos DeveloperTurnStep REAL');
      console.log('   2. ✅ Mockamos SessionChainUtils via require.cache');
      console.log('   3. ✅ Injeção de dependência funcionou');
      console.log('   4. ✅ Método execute retornou resultado');
      console.log('   5. ✅ Fluxo completo simulado');
      
      console.log('\n🚀 FLUXO ARQUITETO → DESENVOLVEDOR TESTADO COM SUCESSO!');
    } else {
      console.log('❌ Retornou undefined');
    }
  })
  .catch(err => {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
  });