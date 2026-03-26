// Teste de FLUXO COMPLETO do ArchitectPlanningStep
// Mostra o contexto de entrada e o contexto de saída para o próximo passo

console.log('=== TESTE DE FLUXO COMPLETO - ArchitectPlanningStep ===\n');

// CONTEXTO DE ENTRADA (baseado no JSON que você forneceu)
const contextoEntrada = {
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
    project: {
      id: "0ad45ce8-90f2-4f4b-baeb-5952d8f2b95f",
      name: "Sistema de Gestão de Tarefas",
      ativo: true,
      status: true,
      modeloAuxiliar: "ollama/qwen3.5:35b-a3b",
      programadorBack: "programador-monitor-tarefas",
      programadorFront: "programador-monitor-tarefas",
      projectType: {
        id: "1ec3e9a2-bbda-4e20-803c-93a4c344ab03",
        name: "Sistema Web",
        personaPrompt: `Você é um arquiteto de software especializado em sistemas web.
Analise os requisitos e crie um plano técnico detalhado.
Foque em:
1. Arquitetura frontend (React/Vue)
2. Backend API (Node.js/Express)
3. Banco de dados (SQL/NoSQL)
4. Autenticação e segurança
5. Deploy e monitoramento`,
        baseRules: `# Regras para Sistemas Web

## Stack Recomendada
- Frontend: React com TypeScript
- Backend: Node.js + Express
- Banco: PostgreSQL ou MongoDB
- Autenticação: JWT + refresh tokens

## Boas Práticas
- Componentes reutilizáveis
- API RESTful com versionamento
- Testes unitários e de integração
- Documentação Swagger/OpenAPI

## Segurança
- Validação de entrada
- Proteção contra XSS e SQL injection
- Rate limiting
- Logs de auditoria`,
        createdAt: "2026-03-17T21:59:05.508Z",
        updatedAt: "2026-03-17T21:59:05.508Z",
      },
      agent: "analistamonitortarefas",
    },
    dependents: [],
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
    regras: `# Regras do Sistema de Gestão de Tarefas

## Fluxo de Trabalho
1. Tarefas são criadas com prioridade e status inicial
2. Agentes IA analisam e executam tarefas automaticamente
3. Monitoramento em tempo real do progresso

## Agentes Disponíveis
- Arquiteto: Planeja soluções técnicas
- Desenvolvedor: Implementa código
- Analista: Analisa requisitos
- QA: Testa implementações

## Regras Técnicas
- Backend: Node.js + Express + Prisma
- Frontend: React + TypeScript
- Banco: SQLite (dev) / PostgreSQL (prod)
- IA: OpenClaw + múltiplos modelos`,
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
    repositoryUrl: "https://github.com/seu-usuario/monitor-tarefas",
    pastaBase: "/home/alexandrebragatorqueti/projetos/monitor-tarefas",
    agent: "analistamonitortarefas",
    programadorFront: "programador-monitor-tarefas",
    programadorBack: "programador-monitor-tarefas",
    frontendBuildCmd: "npm run build",
    backendBuildCmd: "npm run build",
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
    promptFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/prompt-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt",
    relatorioFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/relatorio-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt",
    doneFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/done-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.done",
    terminalLogFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/terminal-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.log",
    architectPlanFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/plano-arquiteto-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt",
    architectLogFile: "/home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/terminal-arquiteto-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.log",
  },
  initialSnapshot: {},
  currentInput: `Você é o Arquiteto de Software Líder do projeto.
Tipo de Tarefa: [DEVELOPMENT]

[CONTEXTO DO PROJETO]
Frontend: /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-web
Backend: /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server
[INFRAESTRUTURA DE PORTAS]
- Frontend roda na porta: 3000
- Backend roda na porta: 4001
(Garanta que o código ou as instruções de ambiente .env respeitem estas portas)

[TAREFA ATUAL]
Título: Cadastro de Prioridades
Descrição: Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.

[REGRAS CRÍTICAS DE SISTEMA]
- EXPLIQUE SEU RACIOCÍNIO PRIMEIRO: Antes de agir, você DEVE explicar brevemente o seu plano de ação para resolver o problema.
- AÇÃO: Após raciocinar, aja estritamente utilizando as ferramentas JSON fornecidas (ex: ferramenta 'write').
- Se a ferramenta 'write' falhar, você DEVE imprimir o plano ou relatório completo no seu output de texto, cercado por tags <PLANO> ... </PLANO>.

=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (DESENVOLVIMENTO) ===
* Apenas analise a tarefa e decida quais arquivos o Desenvolvedor precisará criar ou alterar.
* Formule um passo a passo técnico detalhado (ex: "1. No arquivo X, adicione a rota Y").
* Use a ferramenta 'write' para salvar TODO esse passo a passo EXATAMENTE neste arquivo: /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/plano-arquiteto-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt
* NÃO DÊ MAIS DE UMA OPÇÃO AO DESENVOLVEDOR. SE HOUVER MAIS DE UM CAMINHO ESCOLHA O MELHOR.
* NÃO PEÇA AO DESENVOLVEDOR PARA REALIZAR TESTES. OS TESTES SERÃO FEITOS EM OUTRA ETAPA.
* PROIBIDO criar ou editar arquivos de código-fonte.
* PROIBIDO criar arquivos de status (.done). O seu trabalho é ESTRITAMENTE de planejamento.
* Assim que o plano for salvo com sucesso, responda APENAS com: "Plano salvo. Passando o bastão para o Desenvolvedor."
 

Inicie agora o seu fluxo de trabalho estrito. Comece detalhando seu raciocínio.`,
  developerPrompt: `DESENVOLVEDOR: Analise o plano de ação e crie o código.

TAREFA: Cadastro de Prioridades. DESC: Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.. BASE: /home/alexandrebragatorqueti/projetos/monitor-tarefas.

[REGRAS DE OURO DA ENGINE]
1. PENSE ANTES DE AGIR: Antes de invocar qualquer ferramenta de modificação (edit, write, exec), escreva uma breve frase explicando o seu raciocínio.
2. EXPLORE, NÃO ADIVINHE: Use a ferramenta 'exec' (com 'ls', 'find') para confirmar caminhos antes de editar.
3. SEM BACKUPS MANUAIS: Edite os arquivos originais DIRETAMENTE. O sistema já possui controle de versão.
4. ARQUIVOS TEMPORÁRIOS: Se precisar de rascunhos, crie-os apenas dentro do seu próprio diretório de workspace, nunca na árvore do projeto.

[REGRAS CRÍTICAS PARA A FERRAMENTA 'EDIT']
1. O campo 'old_text' (ou equivalente) DEVE ser uma cópia EXATA, byte por byte, do arquivo original. Isso inclui todos os espaços em branco, tabs e quebras de linha.
2. NUNCA tente adivinhar a formatação. Sempre use a ferramenta 'read' ou 'exec' (com 'cat') no arquivo ANTES de usar 'edit', e copie o trecho original diretamente do retorno da leitura.
3. FALLBACK DE EDIÇÃO: Se o 'edit' continuar falhando por causa de divergência de espaços, desista do 'edit' e use a ferramenta 'write' para reescrever o arquivo INTEIRO com a sua modificação.

[PROTOCOLO DE ENCERRAMENTO (OBRIGATÓRIO)]
Quando tiver certeza absoluta de que a tarefa está concluída e o código (TypeScript/JavaScript) não contém erros de sintaxe, siga ESTES 2 PASSOS EXATOS:

PASSO 1: DOCUMENTAÇÃO
Use a ferramenta 'write' para gerar o seu relatório de conclusão.
- Arquivo destino: /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/relatorio-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt
- Conteúdo: Escreva um resumo técnico das alterações feitas, arquivos modificados e decisões tomadas.

PASSO 2: SINAL VERDE
Use a ferramenta 'exec' para rodar o comando de finalização.
- Comando exato a ser executado: touch /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/done-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.done
- (Atenção: Apenas chame a ferramenta, não tente simular a resposta JSON dela).`,
  commentsSection: "",
  executionLogData: {
    taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
    userId: "0c75d359-ff27-44b3-ad68-144e5d0bd022",
    model: "deepseek/deepseek-chat",
    startedAt: "2026-03-26T21:51:50.229Z",
  },
};

// SIMULAÇÃO DO MÉTODO execute() do ArchitectPlanningStep
function simularArchitectPlanningStep(contexto) {
  console.log('🔧 SIMULANDO ArchitectPlanningStep.execute()...\n');
  
  // 1. Validação inicial
  if (!contexto.task || !contexto.files || !contexto.config) {
    return {
      ...contexto,
      architectPlanningResult: {
        success: false,
        error: 'contexto incompleto (task, files ou config faltando)'
      }
    };
  }

  try {
    // 2. Log do tipo de tarefa
    console.log(`📋 [Arquiteto] Tipo de tarefa: ${contexto.analysisPlan.taskType}`);
    
    // 3. Simular execução do arquiteto (OpenClaw)
    console.log(`🧠 [Arquiteto] Avaliando a tarefa ${contexto.task.id} e montando o plano de ação...`);
    
    // 4. Simular plano gerado pelo arquiteto
    const architectPlan = `PLANO TÉCNICO PARA FORMULÁRIO DE PRIORIDADES

1. ANÁLISE DO COMPONENTE EXISTENTE:
   - Localizar: /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-web/src/components/PriorityManager.tsx
   - Verificar se já existe formulário de cadastro de prioridades
   - Analisar estrutura atual do componente

2. GATILHO DE EXIBIÇÃO:
   - O formulário deve aparecer SOMENTE ao clicar em "Inserir"
   - Verificar se há botão "Inserir" no PriorityManager.tsx
   - Se não houver, criar botão com evento onClick

3. LÓGICA CONDICIONAL:
   - Estado booleano: showPriorityForm (inicialmente false)
   - Botão "Inserir" altera showPriorityForm para true
   - Formulário renderizado condicionalmente: {showPriorityForm && <PriorityForm />}

4. COMPONENTE DE FORMULÁRIO:
   - Criar novo componente: PriorityForm.tsx
   - Campos: nome (string), peso (number 1-5), cor (color picker)
   - Validação: nome obrigatório, peso entre 1-5
   - Botões: Salvar (submit), Cancelar (fecha formulário)

5. INTEGRAÇÃO COM BACKEND:
   - API endpoint: POST /api/priorities
   - Enviar dados do formulário para o backend
   - Atualizar lista de prioridades após sucesso

6. ESTILOS:
   - Usar CSS existente do projeto
   - Manter consistência visual
   - Formulário modal ou inline (dependendo do espaço disponível)`;
    
    console.log(`📝 [Arquiteto] Plano gerado com sucesso (${architectPlan.length} caracteres)`);
    
    // 5. Simular análise da resposta do arquiteto
    const architectAnalysis = {
      hasExecuted: false,
      hasPlan: true,
      confidence: 88,
      executionDetails: null,
      planDetails: "Arquiteto analisou a tarefa e gerou plano técnico detalhado com 6 etapas para implementação do formulário de prioridades com gatilho condicional 'Inserir'.",
      analysisFailed: false
    };
    
    console.log(`📊 [Arquiteto] Análise: hasExecuted=${architectAnalysis.hasExecuted}, hasPlan=${architectAnalysis.hasPlan}, confidence=${architectAnalysis.confidence}%`);
    
    // 6. Decidir fluxo com base na análise
    let updatedPromptContent;
    
    if (architectAnalysis.hasExecuted && architectAnalysis.confidence > 70 && architectPlan.trim()) {
      updatedPromptContent = `=== EXECUÇÃO CONCLUÍDA PELO ARQUITETO ===\n${architectPlan}\n\nVerifique se as alterações descritas acima foram realmente implementadas.`;
      console.log(`🔄 [Arquiteto] Fluxo: Usando execução do arquiteto.`);
    } else if (architectAnalysis.hasPlan && architectPlan.trim()) {
      updatedPromptContent = `=== PLANO DE AÇÃO DO ARQUITETO ===\n${architectPlan}\n\n${contexto.developerPrompt}`;
      console.log(`🔄 [Arquiteto] Fluxo: Substituindo prompt pelo plano + instruções do desenvolvedor.`);
    } else if (architectAnalysis.analysisFailed || !architectPlan.trim()) {
      updatedPromptContent = contexto.developerPrompt;
      console.log(`🔄 [Arquiteto] Fluxo: Mantendo APENAS instruções do desenvolvedor (análise falhou).`);
    } else {
      updatedPromptContent = `=== ANÁLISE DO ARQUITETO ===\n${architectPlan}\n\n${contexto.developerPrompt}\n\nAnalise a resposta acima e execute a tarefa.`;
      console.log(`🔄 [Arquiteto] Fluxo: Resposta ambígua, incluindo análise como referência.`);
    }
    
    // 7. Simular escrita no arquivo de prompt
    console.log(`💾 [Arquiteto] Gravando prompt atualizado em: ${contexto.files.promptFile}`);
    
    // 8. Resultado do planejamento
    const architectPlanningResult = {
      success: true,
      taskId: contexto.task.id,
      hasArchitectPlan: true,
      hasArchitectExecution: false,
      confidence: architectAnalysis.confidence,
      promptUpdated: true
    };
    
    console.log(`✅ [Arquiteto] Planejamento concluído para tarefa ${contexto.task.id}`);
    
    // 9. CONTEXTO DE SAÍDA (para o próximo passo)
    const contextoSaida = {
      ...contexto,
      architectPlanningResult,
      currentInput: updatedPromptContent,
      architectAnalysis,
      architectPlan
    };
    
    return contextoSaida;
    
  } catch (error) {
    console.log(`💥 Erro no ArchitectPlanningStep para tarefa ${contexto.task.id}: ${error.message}`);
    
    return {
      ...contexto,
      architectPlanningResult: {
        success: false,
        error: error.message,
        taskId: contexto.task.id
      },
      shouldAbort: true,
      abortReason: `Falha no planejamento do arquiteto: ${error.message}`
    };
  }
}

// EXECUTAR O TESTE
console.log('🚀 INICIANDO TESTE DE FLUXO COMPLETO\n');

console.log('📥 ========== CONTEXTO DE ENTRADA ==========');
console.log('Tarefa ID:', contextoEntrada.task.id);
console.log('Título:', contextoEntrada.task.title);
console.log('Tipo:', contextoEntrada.analysisPlan.taskType);
console.log('Arquivos preparados:', contextoEntrada.setupResult.filesPrepared);
console.log('Current Input (primeiros 200 chars):', contextoEntrada.currentInput.substring(0, 200) + '...');
console.log('');

// Executar a simulação
const contextoSaida = simularArchitectPlanningStep(contextoEntrada);

console.log('\n📤 ========== CONTEXTO DE SAÍDA ==========');
console.log('✅ architectPlanningResult:');
console.log('   - success:', contextoSaida.architectPlanningResult.success);
console.log('   - taskId:', contextoSaida.architectPlanningResult.taskId);
console.log('   - hasArchitectPlan:', contextoSaida.architectPlanningResult.hasArchitectPlan);
console.log('   - hasArchitectExecution:', contextoSaida.architectPlanningResult.hasArchitectExecution);
console.log('   - confidence:', contextoSaida.architectPlanningResult.confidence);
console.log('   - promptUpdated:', contextoSaida.architectPlanningResult.promptUpdated);

console.log('\n🔍 architectAnalysis:');
if (contextoSaida.architectAnalysis) {
  console.log('   - hasExecuted:', contextoSaida.architectAnalysis.hasExecuted);
  console.log('   - hasPlan:', contextoSaida.architectAnalysis.hasPlan);
  console.log('   - confidence:', contextoSaida.architectAnalysis.confidence);
  console.log('   - analysisFailed:', contextoSaida.architectAnalysis.analysisFailed);
  console.log('   - planDetails (resumo):', contextoSaida.architectAnalysis.planDetails?.substring(0, 100) + '...');
} else {
  console.log('   - ❌ architectAnalysis NÃO preenchido!');
}

console.log('\n📝 architectPlan (primeiras 3 linhas):');
if (contextoSaida.architectPlan) {
  const lines = contextoSaida.architectPlan.split('\n').slice(0, 3);
  lines.forEach(line => console.log('   ', line));
  console.log('   ... (total:', contextoSaida.architectPlan.split('\n').length, 'linhas)');
}

console.log('\n✏️ currentInput (primeiros 300 chars):');
console.log('   ', contextoSaida.currentInput.substring(0, 300).replace(/\n/g, '\n   ') + '...');

console.log('\n⚠️ Campos adicionais no contexto de saída:');
console.log('   - Mesmo task, project, config, files do contexto de entrada');
console.log('   - architectAnalysis: ✅ PREENCHIDO');
console.log('   - architectPlan: ✅ PREENCHIDO');
console.log('   - currentInput: ✅ ATUALIZADO com plano do arquiteto');
console.log('   - architectPlanningResult: ✅ PREENCHIDO');

console.log('\n🎯 ========== PRÓXIMO PASSO ==========');
console.log('O próximo passo (DeveloperExecutionStep) receberá:');
console.log('1. O contexto COMPLETO acima');
console.log('2. currentInput com o plano do arquiteto + instruções do desenvolvedor');
console.log('3. architectAnalysis para decisões de fluxo');
console.log('4. architectPlan para referência técnica');
console.log('5. architectPlanningResult para status do planejamento');

console.log('\n🔗 O fluxo continua com o desenvolvedor implementando o plano!');

// Exportar para uso em outros testes
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    contextoEntrada,
    contextoSaida,
    simularArchitectPlanningStep
  };
}