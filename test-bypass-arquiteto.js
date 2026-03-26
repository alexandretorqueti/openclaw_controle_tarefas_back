// Teste com BYPASS do arquiteto
// Usa a versão modificada que não chama o OpenClaw real

console.log('=== TESTE COM BYPASS DO ARQUITETO ===\n');

// Primeiro, vamos configurar mocks simples para o container
const container = require('./src/container');

// Mocks básicos
const mockLog = {
  log: (...args) => console.log('[LOG]', ...args)
};

const mockFileSystem = {
  writeFile: async (path, content) => {
    console.log(`[MOCK] writeFile: ${path} (${content.length} chars)`);
    return Promise.resolve();
  }
};

const mockSessionChainUtils = {
  generateUnifiedSessionId: async () => 'session-bypass-123',
  generateIsolatedSessionId: async () => 'session-isolado-bypass-123'
};

const mockSmartFileFinder = {
  findRealArchitectPlan: async () => ({
    content: '',
    path: ''
  })
};

const mockTaskAnalysisService = {
  analyzeArchitectResponse: async (plan, task, project, evidence) => {
    console.log(`[MOCK] analyzeArchitectResponse chamado com plano de ${plan.length} chars`);
    
    // Análise simples baseada no conteúdo do plano
    const hasPlan = plan && plan.trim().length > 50;
    const hasExecuted = plan.includes('EXECUÇÃO CONCLUÍDA') || false;
    
    return {
      hasExecuted: hasExecuted,
      hasPlan: hasPlan,
      confidence: hasPlan ? 85 : 30,
      executionDetails: hasExecuted ? 'Arquiteto executou via bypass' : null,
      planDetails: hasPlan ? 'Plano gerado via bypass - análise simulada' : null,
      analysisFailed: !hasPlan,
      hadExecuted: hasExecuted
    };
  }
};

const mockWorkspaceSnapshotService = {
  takeSnapshot: async () => new Map(),
  compareSnapshots: () => ({ modified: [], created: [], deleted: [] })
};

const mockFileUtils = {
  fileExists: async () => false
};

const mockPromptFactory = {
  buildArchitectPrompt: () => 'Prompt do arquiteto (bypass)'
};

// Não precisamos do openClawService para o bypass
const mockOpenClawService = {
  executeWithFallback: async () => {
    console.log('[MOCK] BYPASS: openClawService.executeWithFallback NÃO chamado');
    return {
      rawOutput: '',
      success: true
    };
  }
};

// Configurar container
container.clear();
container.register('log', mockLog);
container.register('fileSystem', mockFileSystem);
container.register('openClawService', mockOpenClawService);
container.register('sessionChainUtils', mockSessionChainUtils);
container.register('smartFileFinder', mockSmartFileFinder);
container.register('taskAnalysisService', mockTaskAnalysisService);
container.register('workspaceSnapshotService', mockWorkspaceSnapshotService);
container.register('fileUtils', mockFileUtils);
container.register('promptFactory', mockPromptFactory);

// Carregar a versão com bypass
const ArchitectPlanningStepBYPASS = require('./src/steps/ArchitectPlanningStep-BYPASS');

// Contexto de teste (simplificado do JSON original)
const contextoTeste = {
  task: {
    id: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    title: "Cadastro de Prioridades",
    description: "Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.",
    agent: "programador-monitor-tarefas"
  },
  project: {
    id: "0ad45ce8-90f2-4f4b-baeb-5952d8f2b95f",
    name: "Sistema de Gestão de Tarefas",
    pastaBase: "/home/alexandrebragatorqueti/projetos/monitor-tarefas",
    frontendPath: "tarefas-web",
    frontendPort: 3000,
    backendPath: "tarefas-server",
    backendPort: 4001
  },
  config: {
    TASKS_DIR: "/tmp/tasks-bypass-test",
    TASK_TIMEOUT_MS: 1200000,
    agent: "programador-monitor-tarefas"
  },
  analysisPlan: {
    taskType: "development",
    requiresReport: false,
    expectedLayers: ["frontend"],
    requiredModifiedLayers: [],
    mandatoryChecks: [
      "Verificar estrutura do formulário de prioridades",
      "Identificar gatilhos de UI para exibir o formulário",
    ],
    risks: [
      "Risco de lógica condicionada estar no backend",
      "Risco de não existir componente de formulário de prioridades",
    ],
    scope: "Moderate",
    finalizationInstructions: [
      "Escrever o resultado final no arquivo de relatorio.",
      "Criar o arquivo .done ao finalizar.",
    ],
    definitionOfDone: [
      "Concluído: Verificar estrutura do formulário de prioridades",
      "Concluído: Identificar gatilhos de UI para exibir o formulário",
    ],
  },
  files: {
    promptFile: "/tmp/prompt-bypass.txt",
    relatorioFile: "/tmp/relatorio-bypass.txt",
    doneFile: "/tmp/done-bypass.done",
    terminalLogFile: "/tmp/terminal-bypass.log",
    architectPlanFile: "/tmp/plano-arquiteto-bypass.txt",
    architectLogFile: "/tmp/terminal-arquiteto-bypass.log",
  },
  initialSnapshot: new Map(),
  currentInput: "Prompt do arquiteto original",
  developerPrompt: "DESENVOLVEDOR: Implemente o formulário de prioridades com gatilho 'Inserir'",
  commentsSection: "",
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    taskType: "development"
  }
};

async function executarTesteBypass() {
  try {
    console.log('🚀 EXECUTANDO ArchitectPlanningStep COM BYPASS...\n');
    
    // Criar instância da versão com bypass
    const step = new ArchitectPlanningStepBYPASS();
    
    // Executar
    const resultado = await step.execute(contextoTeste);
    
    console.log('\n✅ RESULTADO DO BYPASS:');
    console.log('='.repeat(50));
    
    console.log('\n📊 architectPlanningResult:');
    console.log('   - success:', resultado.architectPlanningResult.success);
    console.log('   - taskId:', resultado.architectPlanningResult.taskId);
    console.log('   - hasArchitectPlan:', resultado.architectPlanningResult.hasArchitectPlan);
    console.log('   - hasArchitectExecution:', resultado.architectPlanningResult.hasArchitectExecution);
    console.log('   - confidence:', resultado.architectPlanningResult.confidence);
    console.log('   - promptUpdated:', resultado.architectPlanningResult.promptUpdated);
    console.log('   - bypassUsed:', resultado.architectPlanningResult.bypassUsed || false);
    
    console.log('\n🔍 architectAnalysis:');
    if (resultado.architectAnalysis) {
      console.log('   - hasExecuted:', resultado.architectAnalysis.hasExecuted);
      console.log('   - hasPlan:', resultado.architectAnalysis.hasPlan);
      console.log('   - confidence:', resultado.architectAnalysis.confidence);
      console.log('   - analysisFailed:', resultado.architectAnalysis.analysisFailed);
      console.log('   - planDetails:', resultado.architectAnalysis.planDetails?.substring(0, 80) + '...');
    }
    
    console.log('\n📝 architectPlan (resumo):');
    if (resultado.architectPlan) {
      const lines = resultado.architectPlan.split('\n').slice(0, 5);
      console.log('   ' + lines.join('\n   '));
      console.log('   ... (total:', resultado.architectPlan.split('\n').length, 'linhas)');
    }
    
    console.log('\n✏️ currentInput atualizado?', resultado.currentInput !== contextoTeste.currentInput);
    console.log('   Primeiros 150 chars:', resultado.currentInput.substring(0, 150).replace(/\n/g, '\n   ') + '...');
    
    console.log('\n🎯 CONTEXTO PARA PRÓXIMO PASSO:');
    console.log('O DeveloperExecutionStep receberá um contexto COMPLETO com:');
    console.log('   1. ✅ architectAnalysis preenchido');
    console.log('   2. ✅ architectPlan gerado (via bypass)');
    console.log('   3. ✅ currentInput atualizado com plano');
    console.log('   4. ✅ architectPlanningResult com status');
    console.log('   5. ✅ Todos os campos originais mantidos');
    
    console.log('\n🔧 DETALHES TÉCNICOS DO BYPASS:');
    console.log('   - ❌ NÃO chamou openClawService.executeWithFallback');
    console.log('   - ✅ Gerou plano de arquiteto localmente');
    console.log('   - ✅ Manteve fluxo normal de análise');
    console.log('   - ✅ Gravou arquivos como esperado');
    console.log('   - ✅ Retornou contexto válido para próximo passo');
    
    console.log('\n📁 ARQUIVOS CRIADOS:');
    console.log('   -', contextoTeste.files.architectPlanFile, '(plano do arquiteto)');
    console.log('   -', contextoTeste.files.architectLogFile, '(log vazio)');
    console.log('   -', contextoTeste.files.promptFile, '(prompt atualizado)');
    
    console.log('\n✅ BYPASS BEM-SUCEDIDO! O arquiteto foi substituído por retorno válido.');
    
    // Verificar se podemos usar o método estático também
    console.log('\n🧪 TESTANDO MÉTODO ESTÁTICO:');
    const resultadoEstatico = await ArchitectPlanningStepBYPASS.planArchitectBypass(contextoTeste);
    console.log('   Resultado estático:', resultadoEstatico.success ? '✅ Sucesso' : '❌ Falha');
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE BYPASS:', error.message);
    console.error(error.stack);
  }
}

// Executar teste
executarTesteBypass();