// Debug durante a EXECUÇÃO

console.log('=== DEBUG DURANTE EXECUÇÃO ===\n');

// Mock SessionChainUtils ANTES
require.cache[require.resolve('./src/utils/sessionChainUtils')] = {
  exports: {
    generateLoopSessionId: () => 'mock-session-id'
  }
};

// Intercepta require DURANTE execução
const Module = require('module');
const originalRequire = Module.prototype.require;
const requireLog = [];

Module.prototype.require = function(id) {
  requireLog.push({ id, timestamp: Date.now() });
  return originalRequire.apply(this, arguments);
};

// Carrega e executa
const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');

const mocks = {
  log: async (msg) => console.log('[LOG]', msg),
  openClawService: {
    executeWithFallback: async () => ({
      rawOutput: 'test',
      success: true,
      toolCall: {},
      toolResult: {}
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

const step = new DeveloperTurnStep(mocks);

const context = {
  task: { id: "test", agent: "test" },
  project: { pastaBase: "/tmp" },
  config: { TASKS_DIR: "/tmp", TASK_TIMEOUT_MS: 1000 },
  files: { promptFile: "/tmp/p.txt", doneFile: "/tmp/d.done", terminalLogFile: "/tmp/t.log" },
  turnNumber: 1,
  basePrompt: "test",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('🎯 Executando...\n');

step.execute(context)
  .then(result => {
    console.log('\n✅ Resultado:', result ? 'objeto' : 'undefined');
    
    console.log('\n📋 REQUIRES DURANTE EXECUÇÃO:');
    requireLog.forEach((log, i) => {
      console.log(`   ${i+1}. ${log.id}`);
    });
  })
  .catch(err => {
    console.error('\n❌ ERRO:', err.message);
    console.error('Stack:', err.stack);
    
    console.log('\n📋 REQUIRES ATÉ O ERRO:');
    requireLog.forEach((log, i) => {
      console.log(`   ${i+1}. ${log.id}`);
    });
  })
  .finally(() => {
    // Restaura require
    Module.prototype.require = originalRequire;
  });