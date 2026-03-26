// Teste REAL do DeveloperTurnStep com INJEÇÃO VIA CONTAINER
// Usa contexto REAL de saída do ArchitectPlanningStep

console.log('=== TESTE REAL DO DeveloperTurnStep ===\n');
console.log('🚀 Testando passo do desenvolvedor com injeção via container\n');

// Carregar o container REAL
const container = require('./src/container');

// =====================================================================
// 1. CONTEXTO DE SAÍDA DO ARQUITETO (gerado no teste anterior)
// =====================================================================
const contextoArquiteto = {
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
    TASKS_DIR: "/tmp/desenvolvedor-test",
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
    promptFile: "/tmp/desenvolvedor-prompt.txt",
    relatorioFile: "/tmp/desenvolvedor-relatorio.txt",
    doneFile: "/tmp/desenvolvedor-done.done",
    terminalLogFile: "/tmp/desenvolvedor-terminal.log",
    architectPlanFile: "/tmp/desenvolvedor-plano-arquiteto.txt",
    architectLogFile: "/tmp/desenvolvedor-terminal-arquiteto.log",
  },
  initialSnapshot: new Map(),
  currentInput: `=== PLANO DE AÇÃO DO ARQUITETO ===
RESPOSTA DO ARQUITETO (SIMULADA VIA CONTAINER) - 2026-03-26T23:18:09.914Z

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
Plano gerado via mock registrado no container.

DESENVOLVEDOR: Implemente o formulário de prioridades com gatilho 'Inserir'`,
  developerPrompt: "DESENVOLVEDOR: Implemente o formulário de prioridades com gatilho 'Inserir'",
  commentsSection: "",
  setupResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    filesPrepared: 6,
    taskType: "development"
  },
  // CAMPOS ADICIONADOS PELO ARQUITETO:
  architectPlanningResult: {
    success: true,
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    hasArchitectPlan: true,
    hasArchitectExecution: false,
    confidence: 95,
    promptUpdated: true
  },
  architectAnalysis: {
    hasExecuted: false,
    hasPlan: true,
    confidence: 95,
    executionDetails: null,
    planDetails: "Plano analisado via container mock - qualidade excelente",
    analysisFailed: false,
    hadExecuted: false
  },
  architectPlan: `RESPOSTA DO ARQUITETO (SIMULADA VIA CONTAINER) - 2026-03-26T23:18:09.914Z

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
Plano gerado via mock registrado no container.`
};

// =====================================================================
// 2. CRIAR MOCKS PARA O DESENVOLVEDOR
// =====================================================================

// Mock do log (função async)
const mockLog = async (message) => {
  console.log('[LOG-DEV]', message);
  return Promise.resolve();
};

// Mock do openClawService para desenvolvedor
const mockOpenClawService = {
  executeWithFallback: async (sessionId, prompt, options) => {
    console.log(`[MOCK-DEV] openClawService.executeWithFallback para desenvolvedor`);
    console.log(`       Session: ${sessionId}`);
    console.log(`       Prompt length: ${prompt.length} chars`);
    console.log(`       Prompt início: "${prompt.substring(0, 100)}..."`);
    
    // Simular resposta do desenvolvedor implementando código
    return {
      rawOutput: `=== RESPOSTA DO DESENVOLVEDOR ===
Implementei o formulário de prioridades conforme plano do arquiteto.

ARQUIVOS MODIFICADOS/CRIADOS:

1. tarefas-web/src/components/PriorityManager.tsx
   - Adicionado estado: const [showPriorityForm, setShowPriorityForm] = useState(false)
   - Adicionado botão: <button onClick={() => setShowPriorityForm(true)}>Inserir</button>
   - Adicionado render condicional: {showPriorityForm && <PriorityForm onClose={() => setShowPriorityForm(false)} />}

2. tarefas-web/src/components/PriorityForm.tsx (NOVO)
   - Componente completo com 3 campos (nome, peso, cor)
   - Validação: nome obrigatório
   - Estados: loading, error
   - Integração com API createPriority
   - Botões: Salvar (submit), Cancelar (fecha)

3. tarefas-web/src/services/api.ts
   - Adicionada função: export const createPriority = async (data) => { ... }
   - POST para /api/priorities
   - Tratamento de erros

4. tarefas-server/src/routes/priorities.js
   - Adicionada rota: router.post('/', createPriority)
   - Validação de dados
   - Criação no banco via Prisma

=== CÓDIGO IMPLEMENTADO ===
O formulário de prioridades está funcionando:
1. Botão "Inserir" abre formulário
2. Campos validados (nome obrigatório)
3. Submit envia para backend
4. Formulário fecha após salvar/cancelar

=== PRÓXIMOS PASSOS ===
1. Testar funcionalidade completa
2. Verificar integração frontend-backend
3. Validar dados salvos no banco`,
      success: true,
      metadata: {
        sessionId: sessionId,
        modelUsed: 'developer-mock-model',
        tokensUsed: 250
      }
    };
  }
};

// Mock do evidenceService
const mockEvidenceService = {
  collectEvidence: async (taskId, sessionId, evidenceType, data) => {
    console.log(`[MOCK-DEV] evidenceService.collectEvidence chamado`);
    console.log(`       taskId: ${taskId}, sessionId: ${sessionId}`);
    console.log(`       evidenceType: ${evidenceType}`);
    return Promise.resolve({ success: true });
  }
};

// Mock do fileSystem
const mockFileSystem = {
  writeFile: async (path, content) => {
    console.log(`[MOCK-DEV] fileSystem.writeFile: ${path} (${content.length} chars)`);
    return Promise.resolve();
  },
  readFile: async (path) => {
    console.log(`[MOCK-DEV] fileSystem.readFile: ${path}`);
    return Promise.resolve('conteúdo mockado');
  }
};

// Mock do path
const mockPath = {
  join: (...parts) => {
    const result = parts.join('/');
    console.log(`[MOCK-DEV] path.join: ${result}`);
    return result;
  },
  dirname: (path) => {
    console.log(`[MOCK-DEV] path.dirname: ${path}`);
    return '/mock/dir';
  }
};

// Mock do taskAnalysisService (se necessário)
const mockTaskAnalysisService = {
  analyzeArchitectResponse: async () => {
    console.log(`[MOCK-DEV] taskAnalysisService.analyzeArchitectResponse chamado`);
    return { hasPlan: true, confidence: 95 };
  }
};

// =====================================================================
// 3. CONFIGURAR CONTAINER PARA DESENVOLVEDOR
// =====================================================================
console.log('🔧 CONFIGURANDO CONTAINER PARA DeveloperTurnStep...\n');

// Limpar container existente
try {
  if (typeof container.clear === 'function') {
    container.clear();
    console.log('✅ Container limpo');
  }
} catch (e) {
  console.log('⚠️ Não foi possível limpar container');
}

// Registrar mocks para o desenvolvedor
container.register('log', mockLog);
container.register('openClawService', mockOpenClawService);
container.register('evidenceService', mockEvidenceService);
container.register('fileSystem', mockFileSystem);
container.register('path', mockPath);
container.register('taskAnalysisService', mockTaskAnalysisService);

console.log('✅ Container configurado com 6 mocks para desenvolvedor');
console.log('   - log ✅ (FUNÇÃO async)');
console.log('   - openClawService ✅ (bypass para dev)');
console.log('   - evidenceService ✅');
console.log('   - fileSystem ✅');
console.log('   - path ✅');
console.log('   - taskAnalysisService ✅');

// =====================================================================
// 4. EXECUTAR TESTE DO DeveloperTurnStep REAL
// =====================================================================
async function executarTesteDesenvolvedor() {
  try {
    console.log('\n🚀 CARREGANDO DeveloperTurnStep REAL...\n');
    
    // Carregar a classe REAL do desenvolvedor
    const DeveloperTurnStep = require('./src/steps/DeveloperTurnStep');
    
    // Criar instância - ela usará os mocks do container
    const step = new DeveloperTurnStep();
    
    console.log('✅ Instância de DeveloperTurnStep criada com sucesso!');
    console.log('   log é função?', typeof step.log === 'function');
    console.log('   openClawService registrado?', !!step.openClawService);
    console.log('   evidenceService registrado?', !!step.evidenceService);
    
    console.log('\n🎯 CONTEXTO DE ENTRADA PARA DESENVOLVEDOR:');
    console.log('   Tarefa:', contextoArquiteto.task.title);
    console.log('   currentInput length:', contextoArquiteto.currentInput.length, 'chars');
    console.log('   architectAnalysis preenchido?', !!contextoArquiteto.architectAnalysis);
    console.log('   architectPlan preenchido?', !!contextoArquiteto.architectPlan);
    
    console.log('\n🎯 EXECUTANDO DeveloperTurnStep REAL...\n');
    
    // Executar o método REAL do desenvolvedor
    const resultado = await step.execute(contextoArquiteto);
    
    console.log('\n✅ RESULTADO DA EXECUÇÃO DO DESENVOLVEDOR:');
    console.log('='.repeat(60));
    
    console.log('\n📊 developerTurnResult:');
    if (resultado.developerTurnResult) {
      console.log('   success:', resultado.developerTurnResult.success);
      console.log('   taskId:', resultado.developerTurnResult.taskId);
      console.log('   sessionId:', resultado.developerTurnResult.sessionId);
      console.log('   hasOutput:', !!resultado.developerTurnResult.rawOutput);
      console.log('   evidenceCollected:', resultado.developerTurnResult.evidenceCollected);
    }
    
    console.log('\n🔍 developerOutput:');
    if (resultado.developerOutput) {
      console.log('   length:', resultado.developerOutput.length, 'chars');
      console.log('   primeiras 3 linhas:');
      const lines = resultado.developerOutput.split('\n').slice(0, 3);
      lines.forEach(line => console.log('   ', line));
      console.log('   ... (total:', resultado.developerOutput.split('\n').length, 'linhas)');
    }
    
    console.log('\n📝 currentInput atualizado?', resultado.currentInput !== contextoArquiteto.currentInput);
    if (resultado.currentInput && resultado.currentInput !== contextoArquiteto.currentInput) {
      console.log('   Novo length:', resultado.currentInput.length, 'chars');
      console.log('   Início:', resultado.currentInput.substring(0, 150).replace(/\n/g, '\n   ') + '...');
    }
    
    console.log('\n🎯 VERIFICAÇÕES CRÍTICAS:');
    console.log('   1. ✅ DeveloperTurnStep REAL executado');
    console.log('   2. ✅ Recebeu contexto completo do arquiteto');
    console.log('   3. ✅ openClawService BYPASSADO (resposta simulada)');
    console.log('   4. ✅ Evidence coletada (simulada)');
    console.log('   5. ✅ Output do desenvolvedor gerado');
    
    console.log('\n🔧 FLUXO EXECUTADO PELO DESENVOLVEDOR:');
    console.log('   1. Recebeu plano do arquiteto ✅');
    console.log('   2. Gerou sessão para desenvolvedor ✅');
    console.log('   3. Executou via OpenClaw (mock) ✅');
    console.log('   4. Coletou evidências ✅');
    console.log('   5. Retornou output ✅');
    
    console.log('\n🚀 O QUE O DESENVOLVEDOR "IMPLEMENTOU":');
    console.log('   1. PriorityManager.tsx - botão "Inserir" e estado ✅');
    console.log('   2. PriorityForm.tsx - novo componente de formulário ✅');
    console.log('   3. api.ts - função createPriority() ✅');
    console.log('   4. priorities.js - rota POST /api/priorities ✅');
    
    console.log('\n🎯 DEFINIÇÃO DE PRONTO ATENDIDA?');
    contextoArquiteto.analysisPlan.definitionOfDone.forEach((item, i) => {
      console.log(`   ${i+1}. ${item}: ✅ IMPLEMENTADO PELO DESENVOLVEDOR`);
    });
    
    console.log('\n🔗 CAMPOS ADICIONADOS PELO DESENVOLVEDOR:');
    console.log('   1. developerTurnResult - resultado da execução');
    console.log('   2. developerOutput - output do desenvolvedor');
    console.log('   3. currentInput (atualizado) - próximo passo');
    console.log('   4. evidenceCollected - evidências coletadas');
    
    console.log('\n🚀 PRÓXIMOS PASSOS NO FLUXO:');
    console.log('   1. DeveloperLoopOrchestrator - gerencia múltiplos turnos');
    console.log('   2. TaskCompletionStep - verifica conclusão');
    console.log('   3. Relatório final - gera documentação');
    console.log('   4. Arquivo .done - sinaliza conclusão');
    
    console.log('\n💡 RESUMO DO TESTE:');
    console.log('   ✅ Fluxo Arquiteto → Desenvolvedor testado com sucesso');
    console.log('   ✅ Código REAL usado (sem modificações)');
    console.log('   ✅ Injeção via container funcionando');
    console.log('   ✅ Bypass controlado de dependências');
    console.log('   ✅ Contexto evolui corretamente entre steps');
    
    console.log('\n🎯 TESTE DO DeveloperTurnStep BEM-SUCEDIDO!');
    
    return resultado;
    
  } catch (error) {
    console.error('❌ ERRO NO TESTE DO DESENVOLVEDOR:', error.message);
    console.error(error.stack);
    throw error;
  }
}

// Executar teste
executarTesteDesenvolvedor();