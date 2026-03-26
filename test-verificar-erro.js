// Teste para verificar ERRO COMPLETO no stepError

console.log('=== VERIFICANDO ERRO COMPLETO NO stepError ===\n');

// Primeiro, vou modificar temporariamente o catch para mostrar TUDO
const fs = require('fs');
const path = require('path');

const stepPath = path.join(__dirname, 'src/steps/DeveloperTurnStep.js');
let stepCode = fs.readFileSync(stepPath, 'utf8');

// Substituir o catch por uma versão que loga TUDO
stepCode = stepCode.replace(
  /} catch \(stepError\) \{[\s\S]*?\n\s*\}/,
  `} catch (stepError) {
      console.log('\\n🔍🔍🔍 ERRO COMPLETO NO stepError 🔍🔍🔍');
      console.log('stepError:', stepError);
      console.log('\\n📝 TIPO:', typeof stepError);
      console.log('📝 CONSTRUTOR:', stepError.constructor.name);
      console.log('\\n📝 PROPRIEDADES:');
      Object.getOwnPropertyNames(stepError).forEach(prop => {
        console.log('  -', prop, ':', typeof stepError[prop] === 'function' ? '[Function]' : stepError[prop]);
      });
      console.log('\\n📝 MESSAGE:', stepError.message);
      console.log('📝 STACK:', stepError.stack);
      console.log('📝 CODE:', stepError.code);
      console.log('📝 NAME:', stepError.name);
      console.log('\\n🔍🔍🔍 FIM DO ERRO 🔍🔍🔍');
      
      await this.log(\`💥 Erro no DeveloperTurnStep para tarefa \${task?.id || 'unknown'}: \${stepError.message}\`);
      return {
        ...context,
        turnResult: {
          success: false,
          error: stepError.message,
          turnNumber: turnNumber || 1,
          sessionId: 'error-session',
          fullError: JSON.stringify(stepError, Object.getOwnPropertyNames(stepError))
        }
      };
    }`
);

// Salvar temporariamente
const tempPath = path.join(__dirname, 'DeveloperTurnStep-temp.js');
fs.writeFileSync(tempPath, stepCode);

// Mock SessionChainUtils
require.cache[require.resolve('./src/utils/sessionChainUtils')] = {
  exports: {
    generateLoopSessionId: () => 'temp-session-id'
  }
};

// Carregar versão temporária
const DeveloperTurnStepTemp = require('./DeveloperTurnStep-temp');

// Mocks (os mesmos do teste anterior)
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
      confidence: 95,
      isMeaningless: false,
      isTalkingWithoutAction: false
    })
    // FALTANDO: analyzeDeveloperTurn - este é o erro!
  }
};

// Criar instância
const step = new DeveloperTurnStepTemp(mocks);

// Contexto simples
const context = {
  task: { id: "test-error", agent: "test" },
  project: { pastaBase: "/tmp" },
  config: { TASKS_DIR: "/tmp", TASK_TIMEOUT_MS: 1000 },
  files: { promptFile: "/tmp/p.txt", doneFile: "/tmp/d.done", terminalLogFile: "/tmp/t.log" },
  turnNumber: 1,
  basePrompt: "test",
  lastFeedback: null,
  backupAgent: 'main',
  executionTimestamp: Date.now()
};

console.log('🎯 Executando para ver erro completo...\n');

step.execute(context)
  .then(result => {
    console.log('\n✅ Resultado após erro:');
    console.log('   turnResult.success:', result?.turnResult?.success);
    console.log('   turnResult.error:', result?.turnResult?.error);
    
    // Limpar arquivo temporário
    fs.unlinkSync(tempPath);
  })
  .catch(err => {
    console.error('\n❌ Erro não tratado:', err.message);
    // Limpar arquivo temporário
    fs.unlinkSync(tempPath);
  });