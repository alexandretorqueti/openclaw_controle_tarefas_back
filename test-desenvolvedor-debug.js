// Teste DEBUG do DeveloperTurnStep
// Para identificar por que está retornando undefined

console.log('=== DEBUG DeveloperTurnStep ===\n');

// Carregar a classe diretamente para verificar
const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');

// Criar mocks simples
const mockLog = async (msg) => console.log('[LOG]', msg);
const mockOpenClawService = {
  executeWithFallback: async () => ({
    rawOutput: 'Mock output',
    success: true
  })
};
const mockEvidenceService = {
  collectEvidence: async () => ({ success: true })
};
const mockFileSystem = {
  writeFile: async () => {},
  readFile: async () => 'mock'
};
const mockPath = {
  join: (...parts) => parts.join('/'),
  dirname: () => '/mock'
};
const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => ({ hasPlan: true })
};

// Criar instância com mocks
const step = new DeveloperTurnStep({
  log: mockLog,
  openClawService: mockOpenClawService,
  evidenceService: mockEvidenceService,
  fileSystem: mockFileSystem,
  path: mockPath,
  taskAnalysisService: mockTaskAnalysisService
});

console.log('✅ Instância criada');

// Contexto mínimo
const contextoMinimo = {
  task: {
    id: "test-id",
    title: "Test Task"
  },
  project: {
    pastaBase: "/tmp/test"
  },
  config: {
    TASKS_DIR: "/tmp/test",
    TASK_TIMEOUT_MS: 1000
  },
  files: {
    promptFile: "/tmp/test-prompt.txt"
  },
  turnNumber: 1,
  basePrompt: "Test prompt",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('\n🎯 Executando DeveloperTurnStep com contexto mínimo...\n');

// Executar com try-catch para ver erro
step.execute(contextoMinimo)
  .then(resultado => {
    console.log('✅ DeveloperTurnStep retornou:', resultado ? '✅ Objeto' : '❌ undefined/null');
    if (resultado) {
      console.log('   Keys:', Object.keys(resultado));
      console.log('   turnResult:', resultado.turnResult);
      console.log('   developerTurnResult:', resultado.developerTurnResult);
    }
  })
  .catch(error => {
    console.error('❌ ERRO:', error.message);
    console.error(error.stack);
  });