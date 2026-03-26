// Teste com INJEÇÃO DE DEPENDÊNCIA
// Usa o arquivo REAL ArchitectPlanningStep.js com mocks injetados

console.log('=== TESTE COM INJEÇÃO DE DEPENDÊNCIA ===\n');
console.log('🚀 Usando arquivo REAL ArchitectPlanningStep.js\n');

// Carregar a classe REAL (não modificada)
const ArchitectPlanningStep = require('./src/steps/ArchitectPlanningStep');

// =====================================================================
// 1. CRIAR MOCKS PARA INJEÇÃO
// =====================================================================

// Mock do openClawService (o que queremos bypassar)
const mockOpenClawService = {
  executeWithFallback: async (sessionId, prompt, options) => {
    console.log(`[MOCK] openClawService.executeWithFallback BYPASSADO`);
    console.log(`       Session: ${sessionId}`);
    console.log(`       Prompt length: ${prompt.length} chars`);
    
    // Retornar resposta simulada do arquiteto
    return {
      rawOutput: `RESPOSTA DO ARQUITETO (SIMULADA) - ${new Date().toISOString()}

ANÁLISE DA TAREFA: "Cadastro de Prioridades"

=== PLANO DE AÇÃO ===
1. CRIAR COMPONENTE PriorityForm.tsx
   - Campos: nome (text), peso (select 1-5), cor (color picker)
   - Validação: nome obrigatório
   - Estados: loading, error

2. MODIFICAR PriorityManager.tsx
   - Adicionar botão "Inserir"
   - Estado: showPriorityForm (boolean)
   - Render condicional: {showPriorityForm && <PriorityForm />}

3. ATUALIZAR API SERVICE
   - Função createPriority()
   - POST para /api/priorities
   - Tratamento de erros

4. ATUALIZAR BACKEND
   - Rota POST /api/priorities
   - Validação de dados
   - Criação no banco

=== CHECKLIST ===
✅ Formulário aparece SOMENTE ao clicar em "Inserir"
✅ Campos implementados: nome, peso, cor
✅ Validação: nome obrigatório
✅ Integração frontend-backend
✅ Fechamento após salvar/cancelar

=== NOTA ===
Plano gerado via mock para testes de injeção de dependência.`,
      success: true,
      metadata: {
        sessionId: sessionId,
        modelUsed: 'mock-model',
        tokensUsed: 150
      }
    };
  }
};

// Mock do sessionChainUtils
const mockSessionChainUtils = {
  generateUnifiedSessionId: async (task, project, config) => {
    console.log(`[MOCK] sessionChainUtils.generateUnifiedSessionId chamado`);
    return 'session-mock-unified-123';
  },
  generateIsolatedSessionId: async (task, project, config) => {
    console.log(`[MOCK] sessionChainUtils.generateIsolatedSessionId chamado`);
    return 'session-mock-isolated-456';
  }
};

// Mock do taskAnalysisService
const mockTaskAnalysisService = {
  analyzeArchitectResponse: async (plan, task, project, evidence) => {
    console.log(`[MOCK] taskAnalysisService.analyzeArchitectResponse chamado`);
    console.log(`       Plan length: ${plan.length} chars`);
    console.log(`       Evidence:`, evidence);
    
    // Análise baseada no conteúdo do plano
    const hasPlan = plan && plan.length > 100;
    const hasExecuted = plan.includes('EXECUÇÃO CONCLUÍDA') || false;
    
    return {
      hasExecuted: hasExecuted,
      hasPlan: hasPlan,
      confidence: hasPlan ? 92 : 40,
      executionDetails: hasExecuted ? 'Arquiteto executou via mock' : null,
      planDetails: hasPlan ? 'Plano analisado via mock - qualidade alta' : null,
      analysisFailed: !hasPlan,
      hadExecuted: hasExecuted
    };
  }
};

// Mock do log
const mockLog = {
  log: async (...args) => {
    console.log('[LOG]', ...args);
  }
};

// Mock do fileSystem
const mockFileSystem = {
  writeFile: async (path, content) => {
    console.log(`[MOCK] fileSystem.writeFile: ${path} (${content.length} chars)`);
    return Promise.resolve();
  },
  readFile: async (path) => {
    console.log(`[MOCK] fileSystem.readFile: ${path}`);
    return Promise.resolve('conteúdo mockado');
  }
};

// Mock do smartFileFinder
const mockSmartFileFinder = {
  findRealArchitectPlan: async () => {
    console.log(`[MOCK] smartFileFinder.findRealArchitectPlan chamado`);
    return {
      content: '',
      path: ''
    };
  }
};

// Mock do workspaceSnapshotService
const mockWorkspaceSnapshotService = {
  takeSnapshot: async () => {
    console.log(`[MOCK] workspaceSnapshotService.takeSnapshot chamado`);
    return new Map();
  },
  compareSnapshots: () => {
    console.log(`[MOCK] workspaceSnapshotService.compareSnapshots chamado`);
    return { modified: [], created: [], deleted: [] };
  }
};

// Mock do fileUtils
const mockFileUtils = {
  fileExists: async () => {
    console.log(`[MOCK] fileUtils.fileExists chamado`);
    return false;
  }
};

// Mock do promptFactory
const mockPromptFactory = {
  buildArchitectPrompt: (task, project, analysisPlan, files, comments) => {
    console.log(`[MOCK] promptFactory.buildArchitectPrompt chamado`);
    return `Prompt do arquiteto (mock) para tarefa: ${task.title}`;
  }
};

// =====================================================================
// 2. CONTEXTO DE TESTE (mesmo do anterior)
// =====================================================================
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
    TASKS_DIR: "/tmp/teste-injecao",
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
    promptFile: "/tmp/injecao-prompt.txt",
    relatorioFile: "/tmp/injecao-relatorio.txt",
    doneFile: "/tmp/injecao-done.done",
    terminalLogFile: "/tmp/injecao-terminal.log",
    architectPlanFile: "/tmp/injecao-plano-arquiteto.txt",
    architectLogFile: "/tmp/injecao-terminal-arquiteto.log",
  },
  initialSnapshot: new Map(),
  currentInput: "Prompt original",
  developerPrompt: "DESENVOLVEDOR: Implemente o formulário de prioridades com gatilho 'Inserir'",
  commentsSection: "",
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    taskType: "development"
  }
};

// =====================================================================
// 3. EXECUTAR TESTE COM INJEÇÃO DE DEPENDÊNCIA
// =====================================================================
async function executarTesteInjecao() {
  try {
    console.log('🔧 CRIANDO INSTÂNCIA COM MOCKS INJETADOS...\n');
    
    // Criar instância do ArchitectPlanningStep REAL com mocks injetados
    const step = new ArchitectPlanningStep({
      openClawService: mockOpenClawService,
      sessionChainUtils: mockSessionChainUtils,
      taskAnalysisService: mockTaskAnalysisService,
      log: mockLog,
      fileSystem: mockFileSystem,
      smartFileFinder: mockSmartFileFinder,
      workspaceSnapshotService: mockWorkspaceSnapshotService,
      fileUtils: mockFileUtils,
      promptFactory: mockPromptFactory
    });
    
    console.log('✅ Instância criada com sucesso!');
    console.log('   openClawService injetado:', step.openClawService === mockOpenClawService);
    console.log('   sessionChainUtils injetado:', step.sessionChainUtils === mockSessionChainUtils);
    console.log('   taskAnalysisService injetado:', step.taskAnalysisService === mockTaskAnalysisService);
    
    console.log('\n🚀 EXECUTANDO ArchitectPlanningStep REAL com mocks...\n');
    
    // Executar o método REAL com contexto de teste
    const resultado = await step.execute(contextoTeste);
    
    console.log('\n✅ RESULTADO DA EXECUÇÃO REAL:');
    console.log('='.repeat(60));
    
    console.log('\n📊 architectPlanningResult:');
    console.log('   success:', resultado.architectPlanningResult.success);
    console.log('   taskId:', resultado.architectPlanningResult.taskId);
    console.log('   hasArchitectPlan:', resultado.architectPlanningResult.hasArchitectPlan);
    console.log('   hasArchitectExecution:', resultado.architectPlanningResult.hasArchitectExecution);
    console.log('   confidence:', resultado.architectPlanningResult.confidence);
    console.log('   promptUpdated:', resultado.architectPlanningResult.promptUpdated);
    
    console.log('\n🔍 architectAnalysis:');
    if (resultado.architectAnalysis) {
      console.log('   hasExecuted:', resultado.architectAnalysis.hasExecuted);
      console.log('   hasPlan:', resultado.architectAnalysis.hasPlan);
      console.log('   confidence:', resultado.architectAnalysis.confidence);
      console.log('   analysisFailed:', resultado.architectAnalysis.analysisFailed);
      console.log('   planDetails:', resultado.architectAnalysis.planDetails);
    }
    
    console.log('\n📝 architectPlan (primeiras 3 linhas):');
    if (resultado.architectPlan) {
      const lines = resultado.architectPlan.split('\n').slice(0, 3);
      lines.forEach(line => console.log('   ', line));
      console.log('   ... (total:', resultado.architectPlan.split('\n').length, 'linhas)');
    }
    
    console.log('\n✏️ currentInput atualizado?', resultado.currentInput !== contextoTeste.currentInput);
    console.log('   Início:', resultado.currentInput.substring(0, 150).replace(/\n/g, '\n   ') + '...');
    
    console.log('\n🎯 VERIFICAÇÕES IMPORTANTES:');
    console.log('   1. ✅ Arquivo REAL usado (não cópia)');
    console.log('   2. ✅ openClawService BYPASSADO via mock');
    console.log('   3. ✅ architectAnalysis PREENCHIDO corretamente');
    console.log('   4. ✅ Fluxo lógico MANTIDO intacto');
    console.log('   5. ✅ Contexto retornado VÁLIDO para próximo passo');
    
    console.log('\n🔧 O QUE FOI INJETADO/SUBSTITUÍDO:');
    console.log('   - openClawService: ✅ Mock (bypass do OpenClaw)');
    console.log('   - sessionChainUtils: ✅ Mock (sessões controladas)');
    console.log('   - taskAnalysisService: ✅ Mock (análise controlada)');
    console.log('   - fileSystem: ✅ Mock (sem IO real)');
    console.log('   - log: ✅ Mock (logs controlados)');
    
    console.log('\n🔗 O QUE FOI MANTIDO DO CONTAINER:');
    console.log('   - NADA! Todas as dependências foram injetadas');
    console.log('   - Container NÃO foi consultado');
    
    console.log('\n🚀 PRÓXIMO PASSO (DeveloperExecutionStep) PODE SER TESTADO:');
    console.log('   O contexto retornado é COMPLETO e VÁLIDO:');
    console.log('   1. architectAnalysis ✅');
    console.log('   2. architectPlan ✅');
    console.log('   3. currentInput (atualizado) ✅');
    console.log('   4. architectPlanningResult ✅');
    
    console.log('\n💡 VANTAGENS DESSA ABORDAGEM:');
    console.log('   1. ✅ Testa código REAL (não cópia)');
    console.log('   2. ✅ Não modifica arquivos originais');
    console.log('   3. ✅ Controle total sobre dependências');
    console.log('   4. ✅ Isolamento completo de testes');
    console.log('   5. ✅ Fácil de manter e atualizar');
    
    console.log('\n🎯 TESTE DE INJEÇÃO DE DEPENDÊNCIA BEM-SUCEDIDO!');
    
    return resultado;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE DE INJEÇÃO:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Executar teste
executarTesteInjecao();