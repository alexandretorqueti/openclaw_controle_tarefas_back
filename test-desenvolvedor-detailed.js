// Teste DETALHADO do DeveloperTurnStep
// Com logs em cada passo

console.log('=== DEBUG DETALHADO DeveloperTurnStep ===\n');

// Sobrescrever console.log para capturar tudo
const originalLog = console.log;
const logs = [];
console.log = (...args) => {
  logs.push(args.join(' '));
  originalLog(...args);
};

// Carregar a classe
const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');

// Mock que loga tudo
const mockLog = async (msg) => {
  console.log('[MOCK-LOG]', msg);
};

const mockOpenClawService = {
  executeWithFallback: async (sessionId, prompt, options) => {
    console.log('[MOCK-OPENCLAW] executeWithFallback chamado');
    console.log('[MOCK-OPENCLAW] sessionId:', sessionId);
    console.log('[MOCK-OPENCLAW] prompt length:', prompt.length);
    
    return {
      rawOutput: '=== MOCK OUTPUT ===\nTeste bem-sucedido',
      success: true,
      metadata: { sessionId }
    };
  }
};

const mockEvidenceService = {
  collectEvidence: async (taskId, sessionId, type, data) => {
    console.log('[MOCK-EVIDENCE] collectEvidence chamado');
    return { success: true };
  }
};

const mockFileSystem = {
  writeFile: async (path, content) => {
    console.log('[MOCK-FS] writeFile:', path, '(', content.length, 'chars)');
  },
  readFile: async (path) => {
    console.log('[MOCK-FS] readFile:', path);
    return 'mock content';
  }
};

const mockPath = {
  join: (...parts) => {
    const result = parts.join('/');
    console.log('[MOCK-PATH] join:', result);
    return result;
  },
  dirname: (p) => {
    console.log('[MOCK-PATH] dirname:', p);
    return '/mock';
  }
};

const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => {
    console.log('[MOCK-ANALYSIS] analyzeArchitectResponse chamado');
    return { hasPlan: true };
  }
};

// Criar instância
const step = new DeveloperTurnStep({
  log: mockLog,
  openClawService: mockOpenClawService,
  evidenceService: mockEvidenceService,
  fileSystem: mockFileSystem,
  path: mockPath,
  taskAnalysisService: mockTaskAnalysisService
});

// Contexto
const context = {
  task: { id: "test-id", title: "Test" },
  project: { pastaBase: "/tmp" },
  config: { TASKS_DIR: "/tmp", TASK_TIMEOUT_MS: 1000 },
  files: { promptFile: "/tmp/prompt.txt" },
  turnNumber: 1,
  basePrompt: "Test prompt",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('\n🎯 Executando...\n');

// Executar
step.execute(context)
  .then(result => {
    console.log('\n✅ RESULTADO:');
    console.log('   Result é:', result ? 'objeto' : 'undefined/null');
    if (result) {
      console.log('   Keys:', Object.keys(result));
      console.log('   turnResult:', result.turnResult);
    }
    
    console.log('\n📋 LOGS CAPTURADOS:');
    logs.forEach((log, i) => {
      console.log(`   ${i+1}. ${log.substring(0, 100)}${log.length > 100 ? '...' : ''}`);
    });
  })
  .catch(err => {
    console.error('\n❌ ERRO:', err.message);
    console.error(err.stack);
  })
  .finally(() => {
    // Restaurar console.log
    console.log = originalLog;
  });