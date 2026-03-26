// Teste com versão DEBUG

console.log('=== TESTE COM VERSÃO DEBUG ===\n');

const DeveloperTurnStepDebug = require('./DeveloperTurnStep-debug');

// Mocks (os mesmos do teste completo)
const mockEvidenceService = {
  createEmptyEvidence: () => {
    console.log('[MOCK] createEmptyEvidence');
    return { taskId: '', sessionId: '', data: {} };
  },
  applyExecutionEvidence: () => console.log('[MOCK] applyExecutionEvidence'),
  collectEvidence: async () => ({ success: true })
};

const mockLog = async (msg) => console.log('[LOG]', msg);

const mockOpenClawService = {
  executeWithFallback: async () => {
    console.log('[MOCK] executeWithFallback');
    return {
      rawOutput: 'Test output',
      success: true,
      toolCall: { name: 'test' },
      toolResult: { success: true }
    };
  }
};

const mockFileSystem = {
  writeFile: async () => console.log('[MOCK] writeFile'),
  readFile: async () => 'mock',
  readdir: async () => []
};

const mockPath = {
  join: (...parts) => parts.join('/'),
  dirname: () => '/mock'
};

const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => {
    console.log('[MOCK] analyzeArchitectResponse');
    return { hasPlan: true, isMeaningless: false, isTalkingWithoutAction: false };
  }
};

// Instância
const step = new DeveloperTurnStepDebug({
  log: mockLog,
  openClawService: mockOpenClawService,
  evidenceService: mockEvidenceService,
  fileSystem: mockFileSystem,
  path: mockPath,
  taskAnalysisService: mockTaskAnalysisService
});

// Contexto
const context = {
  task: { id: "test", title: "Test", agent: "test" },
  project: { pastaBase: "/tmp" },
  config: { TASKS_DIR: "/tmp", TASK_TIMEOUT_MS: 1000 },
  files: { promptFile: "/tmp/p.txt", doneFile: "/tmp/d.done", terminalLogFile: "/tmp/t.log" },
  turnNumber: 1,
  basePrompt: "Test prompt",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('🎯 Executando...\n');

step.execute(context)
  .then(result => {
    console.log('\n✅ RESULTADO:');
    console.log(result ? '✅ Objeto retornado' : '❌ undefined');
    if (result) console.log('Keys:', Object.keys(result));
  })
  .catch(err => {
    console.error('\n❌ ERRO CAPTURADO:');
    console.error(err.message);
    console.error(err.stack);
  });