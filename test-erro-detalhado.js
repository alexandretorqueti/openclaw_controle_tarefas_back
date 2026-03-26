// Teste para ver erro detalhado

console.log('=== TESTE ERRO DETALHADO ===\n');

// Mock SessionChainUtils
require.cache[require.resolve('./src/utils/sessionChainUtils')] = {
  exports: {
    generateLoopSessionId: () => 'debug-session-id'
  }
};

// Carregar DeveloperTurnStep (com catch modificado)
const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');

// Mocks - FALTANDO analyzeDeveloperTurn de propósito
const mocks = {
  log: async (msg) => console.log('[LOG]', msg),
  
  openClawService: {
    executeWithFallback: async () => ({
      rawOutput: 'Test output',
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
      confidence: 95
    })
    // FALTANDO: analyzeDeveloperTurn - este é o erro!
  }
};

// Instância
const step = new DeveloperTurnStep(mocks);

// Contexto
const context = {
  task: { id: "debug-task", agent: "debug" },
  project: { pastaBase: "/tmp/debug" },
  config: { TASKS_DIR: "/tmp/debug", TASK_TIMEOUT_MS: 1000 },
  files: { 
    promptFile: "/tmp/debug-prompt.txt", 
    doneFile: "/tmp/debug-done.done", 
    terminalLogFile: "/tmp/debug-terminal.log" 
  },
  turnNumber: 1,
  basePrompt: "Debug prompt",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('🎯 Executando...\n');

step.execute(context)
  .then(result => {
    console.log('\n✅ Resultado após erro:');
    console.log('   turnResult.success:', result?.turnResult?.success);
    console.log('   turnResult.error:', result?.turnResult?.error);
    console.log('   turnResult.errorType:', result?.turnResult?.errorType);
    console.log('   turnResult.hasStack:', result?.turnResult?.hasStack);
  })
  .catch(err => {
    console.error('\n❌ Erro não tratado pelo catch:', err.message);
  });