// Teste manual para verificar se architectAnalysis é preenchido corretamente
// Este teste pode ser executado com: node test-architect-analysis-manual.js

const container = require('./src/container');
const ArchitectPlanningStep = require('./src/steps/ArchitectPlanningStep');

// Mock simples para substituir as dependências
const mockLog = {
  log: (...args) => console.log('[LOG]', ...args)
};

// Criar uma instância mock do step com log disponível
class MockArchitectPlanningStep extends ArchitectPlanningStep {
  constructor() {
    super();
    this.log = (...args) => console.log('[STEP LOG]', ...args);
    this.fileSystem = mockFileSystem;
  }
}

const mockOpenClawService = {
  executeWithFallback: async () => ({
    rawOutput: 'Resposta raw do arquiteto',
    success: true
  })
};

const mockSessionChainUtils = {
  generateUnifiedSessionId: async () => 'session-arquiteto-123',
  generateIsolatedSessionId: async () => 'session-isolado-123'
};

const mockSmartFileFinder = {
  findRealArchitectPlan: async () => ({
    content: 'Plano detalhado do arquiteto para formulário de prioridades\n1. Verificar componente PriorityManager.tsx\n2. Analisar gatilho de exibição do formulário\n3. Implementar lógica condicional',
    path: '/tmp/plano-arquiteto.txt'
  })
};

const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => ({
    hasExecuted: false,
    hasPlan: true,
    confidence: 85,
    executionDetails: null,
    planDetails: 'Arquiteto gerou plano detalhado para implementação do formulário de prioridades',
    analysisFailed: false
  })
};

const mockWorkspaceSnapshotService = {
  takeSnapshot: async () => new Map(),
  compareSnapshots: () => ({ modified: [], created: [], deleted: [] })
};

const mockFileUtils = {
  fileExists: async () => false
};

const mockFileSystem = {
  writeFile: async () => {}
};

const mockPromptFactory = {
  buildArchitectPrompt: () => 'Prompt do arquiteto gerado'
};

// Configurar container com mocks
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

// Contexto real baseado no JSON fornecido
const realContext = {
  task: {
    id: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    title: "Cadastro de Prioridades",
    description: "Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.",
    isCompleted: false,
    deadline: "2026-04-02T21:34:33.307Z",
    position: 1,
    createdAt: "2026-03-26T21:35:29.367Z",
    updatedAt: "2026-03-26T21:51:26.913Z",
    isRecurring: false,
    recurrenceType: null,
    recurrenceTimes: null,
    recurrenceDays: null,
    lastExecutedAt: null,
    nextExecutionAt: null,
    agent: "programador-monitor-tarefas",
    domain: "FRONTEND",
    isDecomposed: false,
    isAtomic: true,
    isExecuting: true,
    hasChildExecuting: false,
    projectId: "0ad45ce8-90f2-4f4b-baeb-5952d8f2b95f",
    parentTaskId: null,
    statusId: "e821b3ad-ebf3-4f3d-9ddb-718400aebd60",
    priorityId: "f1c66438-2b75-4374-b8ab-2d71b65f0233",
    createdById: "35e0528b-68ec-45a3-8783-3552c2a43f1c",
    assignedToId: "0c75d359-ff27-44b3-ad68-144e5d0bd022",
    arquitetosPromptContent: null,
    arquitetosAnalysisContent: null,
    arquitetosTerminalContent: null,
    programadorTerminalContent: null,
    programadorReportContent: null,
    priority: {
      id: "f1c66438-2b75-4374-b8ab-2d71b65f0233",
      name: "Média",
      weight: 2,
    },
    status: {
      id: "e821b3ad-ebf3-4f3d-9ddb-718400aebd60",
      name: "Pendente",
      colorCode: "#EF476F",
      isFinalState: false,
      visibleToAi: true,
      order: 1,
    },
  },
  userId: "0c75d359-ff27-44b3-ad68-144e5d0bd022",
  config: {
    TASKS_DIR: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/",
    TASK_TIMEOUT_MS: 1200000,
    MY_USER_ID: "0c75d359-ff27-44b3-ad68-144e5d0bd022",
    agent: "programador-monitor-tarefas",
  },
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    fileListCount: 194,
    taskType: "development",
  },
  project: {
    id: "0ad45ce8-90f2-4f4b-baeb-5952d8f2b95f",
    name: "Sistema de Gestão de Tarefas",
    description: "Sistema completo para gestão de tarefas com arquitetura de agentes IA",
    status: true,
    ativo: true,
    createdAt: "2026-03-17T21:59:05.462Z",
    updatedAt: "2026-03-26T02:48:46.584Z",
    createdById: "35e0528b-68ec-45a3-8783-3552c2a43f1c",
    projectTypeId: "1ec3e9a2-bbda-4e20-803c-93a4c344ab03",
    frontendPath: "tarefas-web",
    frontendPort: 3000,
    backendPath: "tarefas-server",
    backendPort: 4001,
    pastaBase: "/home/alexandrebragatorqueti/projetos/monitor-tarefas",
    agent: "analistamonitortarefas",
    programadorFront: "programador-monitor-tarefas",
    programadorBack: "programador-monitor-tarefas",
    modeloAuxiliar: "ollama/qwen3.5:35b-a3b",
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
    promptFile: "/tmp/prompt.txt",
    relatorioFile: "/tmp/relatorio.txt",
    doneFile: "/tmp/done.done",
    terminalLogFile: "/tmp/terminal.log",
    architectPlanFile: "/tmp/plano-arquiteto.txt",
    architectLogFile: "/tmp/terminal-arquiteto.log",
  },
  initialSnapshot: new Map(),
  currentInput: "Prompt do arquiteto",
  developerPrompt: "Prompt do desenvolvedor",
  commentsSection: "",
};

async function runTest() {
  try {
    console.log('=== INICIANDO TESTE MANUAL ===');
    console.log('Verificando se architectAnalysis é preenchido corretamente...\n');
    
    // Adicionar log para verificar se os mocks estão sendo chamados
    console.log('Configurando mocks...');
    console.log('mockTaskAnalysisService.analyzeArchitectResponse configurado?', typeof mockTaskAnalysisService.analyzeArchitectResponse);
    
    const step = new MockArchitectPlanningStep();
    const result = await step.execute(realContext);
    
    console.log('=== RESULTADO DO TESTE ===');
    console.log('1. architectAnalysis está definido?', result.architectAnalysis !== undefined);
    
    if (result.architectAnalysis) {
      console.log('2. architectAnalysis conteúdo:');
      console.log('   - hasExecuted:', result.architectAnalysis.hasExecuted);
      console.log('   - hasPlan:', result.architectAnalysis.hasPlan);
      console.log('   - confidence:', result.architectAnalysis.confidence);
      console.log('   - analysisFailed:', result.architectAnalysis.analysisFailed);
      console.log('   - planDetails:', result.architectAnalysis.planDetails?.substring(0, 100) + '...');
    }
    
    console.log('\n3. architectPlanningResult:');
    console.log('   - success:', result.architectPlanningResult?.success);
    console.log('   - taskId:', result.architectPlanningResult?.taskId);
    console.log('   - hasArchitectPlan:', result.architectPlanningResult?.hasArchitectPlan);
    console.log('   - hasArchitectExecution:', result.architectPlanningResult?.hasArchitectExecution);
    console.log('   - confidence:', result.architectPlanningResult?.confidence);
    
    console.log('\n4. architectPlan definido?', result.architectPlan !== undefined);
    console.log('5. currentInput atualizado?', result.currentInput !== realContext.currentInput);
    
    console.log('\n=== CONCLUSÃO ===');
    if (result.architectAnalysis && 
        result.architectAnalysis.hasPlan === true &&
        result.architectAnalysis.confidence === 85 &&
        result.architectAnalysis.analysisFailed === false) {
      console.log('✅ TESTE PASSOU: architectAnalysis foi preenchido corretamente!');
    } else {
      console.log('❌ TESTE FALHOU: architectAnalysis não foi preenchido como esperado.');
    }
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE:', error.message);
    console.error(error.stack);
  }
}

runTest();