// test/unit/steps/ArchitectPlanningStep.test.js

const container = require('../../src/container');
const ArchitectPlanningStep = require('../../src/steps/ArchitectPlanningStep');

// Importar factories de mocks
const { createLoggerMock } = require('../mocks/logger.mock');
const { createOpenClawServiceMock } = require('../mocks/openClawService.mock');
const { createSessionChainUtilsMock } = require('../mocks/sessionChainUtils.mock');
const { createSmartFileFinderMock } = require('../mocks/smartFileFinder.mock');
const { createTaskAnalysisServiceMock } = require('../mocks/taskAnalysisService.mock');
const { createWorkspaceSnapshotServiceMock } = require('../mocks/workspaceSnapshotService.mock');
const { createFileUtilsMock } = require('../mocks/fileUtils.mock');
const { createPromptFactoryMock } = require('../mocks/promptFactory.mock');

describe('ArchitectPlanningStep', () => {
  let step;
  let mocks;
  
  const mockTask = {
    id: 'task-architect-123',
    title: 'Tarefa para arquiteto',
    description: 'Descrição',
    agent: 'main'
  };
  
  const mockProject = {
    id: 'project-456',
    name: 'Projeto Teste',
    pastaBase: '/tmp/project',
    agent: 'main'
  };
  
  const mockFiles = {
    promptFile: '/tmp/tasks/prompt-task-architect-123.txt',
    relatorioFile: '/tmp/tasks/relatorio-task-architect-123.txt',
    doneFile: '/tmp/tasks/done-task-architect-123.done',
    terminalLogFile: '/tmp/tasks/terminal-task-architect-123.log',
    architectPlanFile: '/tmp/tasks/plano-arquiteto-task-architect-123.txt',
    architectLogFile: '/tmp/tasks/terminal-arquiteto-task-architect-123.log'
  };
  
  const mockConfig = {
    TASKS_DIR: '/tmp/tasks',
    TASK_TIMEOUT_MS: 60000
  };
  
  const mockInitialSnapshot = new Map([
    ['/tmp/project/file1.js', 1234567890],
    ['/tmp/project/file2.js', 1234567890]
  ]);
  
  const mockAnalysisPlan = {
    taskType: 'development',
    scope: 'Moderate',
    mandatoryChecks: ['Verificar execução'],
    finalizationInstructions: ['Criar .done']
  };
  
  beforeEach(() => {
    // Limpar container antes de cada teste
    container.clear();
    
    // Criar mocks básicos
    mocks = {
      log: createLoggerMock(),
      fileSystem: {
        writeFile: jest.fn().mockResolvedValue(undefined)
      }
    };
    
    // Criar mocks dos serviços
    mocks.openClawService = createOpenClawServiceMock();
    mocks.sessionChainUtils = createSessionChainUtilsMock();
    mocks.smartFileFinder = createSmartFileFinderMock();
    mocks.taskAnalysisService = createTaskAnalysisServiceMock();
    mocks.workspaceSnapshotService = createWorkspaceSnapshotServiceMock();
    mocks.fileUtils = createFileUtilsMock();
    mocks.promptFactory = createPromptFactoryMock();
    
    // Configurar mocks específicos
    mocks.sessionChainUtils.generateUnifiedSessionId.mockResolvedValue('session-arquiteto-123');
    
    mocks.openClawService.executeWithFallback.mockResolvedValue({
      rawOutput: 'Resposta raw do arquiteto',
      success: true
    });
    
    mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
      content: 'Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.',
      path: mockFiles.architectPlanFile
    });
    
    mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
      hasExecuted: false,
      hasPlan: true,
      confidence: 85,
      executionDetails: null,
      planDetails: 'Plano detalhado gerado',
      analysisFailed: false
    });
    
    mocks.fileUtils.fileExists.mockResolvedValue(false); // doneFile não existe por padrão
    
    mocks.promptFactory.buildArchitectPrompt.mockReturnValue('Prompt do arquiteto gerado');
    
    // Registrar mocks no container
    container.register('log', mocks.log);
    container.register('fileSystem', mocks.fileSystem);
    container.register('openClawService', mocks.openClawService);
    container.register('sessionChainUtils', mocks.sessionChainUtils);
    container.register('smartFileFinder', mocks.smartFileFinder);
    container.register('taskAnalysisService', mocks.taskAnalysisService);
    container.register('workspaceSnapshotService', mocks.workspaceSnapshotService);
    container.register('fileUtils', mocks.fileUtils);
    container.register('promptFactory', mocks.promptFactory);
    
    // Criar instância do step
    step = new ArchitectPlanningStep();
  });
  
  afterEach(() => {
    jest.clearAllMocks();
    container.clear();
  });
  
  describe('execução bem-sucedida', () => {
    it('deve verificar se architectAnalysis é preenchido corretamente com contexto real', async () => {
      // Contexto completo baseado na tarefa real "Cadastro de Prioridades"
      // Usando strings normais para evitar problemas de template literals
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
              personaPrompt: "Você é um arquiteto de software especializado em sistemas web.\nAnalise os requisitos e crie um plano técnico detalhado.\nFoque em:\n1. Arquitetura frontend (React/Vue)\n2. Backend API (Node.js/Express)\n3. Banco de dados (SQL/NoSQL)\n4. Autenticação e segurança\n5. Deploy e monitoramento",
              baseRules: "# Regras para Sistemas Web\n\n## Stack Recomendada\n- Frontend: React com TypeScript\n- Backend: Node.js + Express\n- Banco: PostgreSQL ou MongoDB\n- Autenticação: JWT + refresh tokens\n\n## Boas Práticas\n- Componentes reutilizáveis\n- API RESTful com versionamento\n- Testes unitários e de integração\n- Documentação Swagger/OpenAPI\n\n## Segurança\n- Validação de entrada\n- Proteção contra XSS e SQL injection\n- Rate limiting\n- Logs de auditoria",
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
          regras: "# Regras do Sistema de Gestão de Tarefas\n\n## Fluxo de Trabalho\n1. Tarefas são criadas com prioridade e status inicial\n2. Agentes IA analisam e executam tarefas automaticamente\n3. Monitoramento em tempo real do progresso\n\n## Agentes Disponíveis\n- Arquiteto: Planeja soluções técnicas\n- Desenvolvedor: Implementa código\n- Analista: Analisa requisitos\n- QA: Testa implementações\n\n## Regras Técnicas\n- Backend: Node.js + Express + Prisma\n- Frontend: React + TypeScript\n- Banco: SQLite (dev) / PostgreSQL (prod)\n- IA: OpenClaw + múltiplos modelos",
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
        initialSnapshot: new Map(),
        currentInput: "Você é o Arquiteto de Software Líder do projeto.\nTipo de Tarefa: [DEVELOPMENT]\n\n[CONTEXTO DO PROJETO]\nFrontend: /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-web\nBackend: /home/alexandrebragatorqueti/projetos/monitor-tarefas/tarefas-server\n[INFRAESTRUTURA DE PORTAS]\n- Frontend roda na porta: 3000\n- Backend roda na porta: 4001\n(Garanta que o código ou as instruções de ambiente .env respeitem estas portas)\n\n[TAREFA ATUAL]\nTítulo: Cadastro de Prioridades\nDescrição: Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.\n\n[REGRAS CRÍTICAS DE SISTEMA]\n- EXPLIQUE SEU RACIOCÍNIO PRIMEIRO: Antes de agir, você DEVE explicar brevemente o seu plano de ação para resolver o problema.\n- AÇÃO: Após raciocinar, aja estritamente utilizando as ferramentas JSON fornecidas (ex: ferramenta 'write').\n- Se a ferramenta 'write' falhar, você DEVE imprimir o plano ou relatório completo no seu output de texto, cercado por tags <PLANO> ... </PLANO>.\n\n=== SEU FLUXO DE TRABALHO OBRIGATÓRIO (DESENVOLVIMENTO) ===\n* Apenas analise a tarefa e decida quais arquivos o Desenvolvedor precisará criar ou alterar.\n* Formule um passo a passo técnico detalhado (ex: \"1. No arquivo X, adicione a rota Y\").\n* Use a ferramenta 'write' para salvar TODO esse passo a passo EXATAMENTE neste arquivo: /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/plano-arquiteto-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt\n* NÃO DÊ MAIS DE UMA OPÇÃO AO DESENVOLVEDOR. SE HOUVER MAIS DE UM CAMINHO ESCOLHA O MELHOR.\n* NÃO PEÇA AO DESENVOLVEDOR PARA REALIZAR TESTES. OS TESTES SERÃO FEITOS EM OUTRA ETAPA.\n* PROIBIDO criar ou editar arquivos de código-fonte.\n* PROIBIDO criar arquivos de status (.done). O seu trabalho é ESTRITAMENTE de planejamento.\n* Assim que o plano for salvo com sucesso, responda APENAS com: \"Plano salvo. Passando o bastão para o Desenvolvedor.\"\n \n\nInicie agora o seu fluxo de trabalho estrito. Comece detalhando seu raciocínio.",
        developerPrompt: "DESENVOLVEDOR: Analise o plano de ação e crie o código.\n\nTAREFA: Cadastro de Prioridades. DESC: Formulário de cadastro de Prioridades deve aparecer somente ao selecionarmos 'Inserir'.. BASE: /home/alexandrebragatorqueti/projetos/monitor-tarefas.\n\n[REGRAS DE OURO DA ENGINE]\n1. PENSE ANTES DE AGIR: Antes de invocar qualquer ferramenta de modificação (edit, write, exec), escreva uma breve frase explicando o seu raciocínio.\n2. EXPLORE, NÃO ADIVINHE: Use a ferramenta 'exec' (com 'ls', 'find') para confirmar caminhos antes de editar.\n3. SEM BACKUPS MANUAIS: Edite os arquivos originais DIRETAMENTE. O sistema já possui controle de versão.\n4. ARQUIVOS TEMPORÁRIOS: Se precisar de rascunhos, crie-os apenas dentro do seu próprio diretório de workspace, nunca na árvore do projeto.\n\n[REGRAS CRÍTICAS PARA A FERRAMENTA 'EDIT']\n1. O campo 'old_text' (ou equivalente) DEVE ser uma cópia EXATA, byte por byte, do arquivo original. Isso inclui todos os espaços em branco, tabs e quebras de linha.\n2. NUNCA tente adivinhar a formatação. Sempre use a ferramenta 'read' ou 'exec' (com 'cat') no arquivo ANTES de usar 'edit', e copie o trecho original diretamente do retorno da leitura.\n3. FALLBACK DE EDIÇÃO: Se o 'edit' continuar falhando por causa de divergência de espaços, desista do 'edit' e use a ferramenta 'write' para reescrever o arquivo INTEIRO com a sua modificação.\n\n[PROTOCOLO DE ENCERRAMENTO (OBRIGATÓRIO)]\nQuando tiver certeza absoluta de que a tarefa está concluída e o código (TypeScript/JavaScript) não contém erros de sintaxe, siga ESTES 2 PASSOS EXATOS:\n\nPASSO 1: DOCUMENTAÇÃO\nUse a ferramenta 'write' para gerar o seu relatório de conclusão.\n- Arquivo destino: /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/relatorio-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.txt\n- Conteúdo: Escreva um resumo técnico das alterações feitas, arquivos modificados e decisões tomadas.\n\nPASSO 2: SINAL VERDE\nUse a ferramenta 'exec' para rodar o comando de finalização.\n- Comando exato a ser executado: touch /home/alexandrebragatorqueti/.openclaw/workspace/pending-tasks/done-1d9d1a31-26ee-4f74-b7a8-7d7297b00447.done\n- (Atenção: Apenas chame a ferramenta, não tente simular a resposta JSON dela).",
        commentsSection: "",
        executionLogData: {
          taskId: "1d9d1a31-26ee-4f74-b7a8-7d7297b00447",
          userId: "0c75d359-ff27-44b3-ad68-144e5d0bd022",
          model: "deepseek/deepseek-chat",
          startedAt: "2026-03-26T21:51:50.229Z",
        },
      };
      
      // Configurar mocks para retornar um plano de arquiteto
      mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
        content: "Plano detalhado do arquiteto para formulário de prioridades\n1. Verificar componente PriorityManager.tsx\n2. Analisar gatilho de exibição do formulário\n3. Implementar lógica condicional",
        path: realContext.files.architectPlanFile
      });
      
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: false,
        hasPlan: true,
        confidence: 85,
        executionDetails: null,
        planDetails: "Arquiteto gerou plano detalhado para implementação do formulário de prioridades",
        analysisFailed: false
      });
      
      const result = await step.execute(realContext);
      
      // VERIFICAÇÕES PRINCIPAIS: architectAnalysis deve estar preenchido corretamente
      expect(result.architectAnalysis).toBeDefined();
      expect(result.architectAnalysis).toEqual({
        hasExecuted: false,
        hasPlan: true,
        confidence: 85,
        executionDetails: null,
        planDetails: "Arquiteto gerou plano detalhado para implementação do formulário de prioridades",
        analysisFailed: false
      });
      
      // Verificar se os mocks foram chamados com os parâmetros corretos
      expect(mocks.taskAnalysisService.analyzeArchitectResponse).toHaveBeenCalledWith(
        "Plano detalhado do arquiteto para formulário de prioridades\n1. Verificar componente PriorityManager.tsx\n2. Analisar gatilho de exibição do formulário\n3. Implementar lógica condicional",
        realContext.task,
        realContext.project
      );
      
      // Verificar se o resultado contém os dados esperados
      expect(result.architectPlanningResult.success).toBe(true);
      expect(result.architectPlanningResult.taskId).toBe(realContext.task.id);
      expect(result.architectPlanningResult.hasArchitectPlan).toBe(true);
      expect(result.architectPlanningResult.hasArchitectExecution).toBe(false);
      expect(result.architectPlanningResult.confidence).toBe(85);
      expect(result.architectPlanningResult.promptUpdated).toBe(true);
      
      // Verificar se o plano do arquiteto está presente
      expect(result.architectPlan).toBe("Plano detalhado do arquiteto para formulário de prioridades\n1. Verificar componente PriorityManager.tsx\n2. Analisar gatilho de exibição do formulário\n3. Implementar lógica condicional");
      
      // Verificar se o currentInput foi atualizado corretamente
      expect(result.currentInput).toContain("PLANO DE AÇÃO DO ARQUITETO");
      expect(result.currentInput).toContain("Plano detalhado do arquiteto para formulário de prioridades");
      
      // Verificar logs importantes
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Tipo de tarefa: development')
      );
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Plano recuperado com sucesso')
      );
    });
  
    it('deve executar planejamento do arquiteto com plano gerado', async () => {
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: 'Comentários',
        developerPrompt: 'Prompt do desenvolvedor',
        currentInput: 'Prompt original'
      };
      
      const result = await step.execute(context);
      
      // 1. Deve ter logado tipo de tarefa
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Tipo de tarefa: development')
      );
      
      // 2. Deve ter gerado prompt do arquiteto
      expect(mocks.promptFactory.buildArchitectPrompt).toHaveBeenCalledWith(
        mockTask,
        mockProject,
        expect.any(Array),
        mockFiles.architectPlanFile,
        'Comentários',
        'development'
      );
      
      // 3. Deve ter gerado sessão unificada
      expect(mocks.sessionChainUtils.generateUnifiedSessionId).toHaveBeenCalledWith(
        mockTask.id,
        'arquiteto'
      );
      
      // 4. Deve ter executado OpenClaw
      expect(mocks.openClawService.executeWithFallback).toHaveBeenCalledWith(
        'session-arquiteto-123',
        'Prompt do arquiteto gerado',
        'main',
        'main',
        null,
        '/tmp/tasks',
        mockFiles.architectLogFile,
        '/tmp/project',
        60000
      );
      
      // 5. Deve ter buscado plano
      expect(mocks.smartFileFinder.findRealArchitectPlan).toHaveBeenCalledWith(
        mockFiles.architectPlanFile,
        '/tmp/tasks',
        5
      );
      
      // 6. Deve ter analisado resposta
      expect(mocks.taskAnalysisService.analyzeArchitectResponse).toHaveBeenCalledWith(
        'Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.',
        mockTask,
        mockProject
      );
      
      // 7. Deve ter verificado existência de doneFile
      expect(mocks.fileUtils.fileExists).toHaveBeenCalledWith(mockFiles.doneFile);
      
      // 8. Deve ter escrito prompt atualizado (fluxo com plano)
      expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
        mockFiles.promptFile,
        expect.stringContaining('PLANO DE AÇÃO DO ARQUITETO')
      );
      
      // 9. Resultado deve indicar sucesso
      expect(result.architectPlanningResult.success).toBe(true);
      expect(result.architectPlanningResult.taskId).toBe(mockTask.id);
      expect(result.architectPlanningResult.hasArchitectPlan).toBe(true);
      expect(result.architectPlanningResult.hasArchitectExecution).toBe(false);
      expect(result.architectPlanningResult.confidence).toBe(85);
      expect(result.architectPlanningResult.promptUpdated).toBe(true);
      
      // 10. Contexto deve conter análise e plano
      expect(result.architectAnalysis).toEqual({
        hasExecuted: false,
        hasPlan: true,
        confidence: 85,
        executionDetails: null,
        planDetails: 'Plano detalhado gerado',
        analysisFailed: false
      });
      expect(result.architectPlan).toBe('Plano detalhado do arquiteto\nCom múltiplas etapas\ne instruções precisas.');
      expect(result.currentInput).toContain('PLANO DE AÇÃO DO ARQUITETO');
    });
    
    it('deve usar rawOutput quando arquivo não encontrado', async () => {
      // Configurar smartFileFinder para retornar sem conteúdo
      mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
        content: '',
        path: ''
      });
      
      // Configurar rawOutput longo
      mocks.openClawService.executeWithFallback.mockResolvedValue({
        rawOutput: 'Raw output longo do arquiteto com mais de 50 caracteres para ser usado como fallback',
        success: true
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      await step.execute(context);
      
      // Deve ter escrito rawOutput no arquivo de plano
      expect(mocks.fileSystem.writeFile).toHaveBeenCalledWith(
        mockFiles.architectPlanFile,
        'Raw output longo do arquiteto com mais de 50 caracteres para ser usado como fallback'
      );
      
      // Deve ter logado sobre fallback
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Usando rawOutput do terminal como fallback')
      );
    });
    
    it('deve validar evidências quando arquiteto diz que executou', async () => {
      // Configurar análise indicando execução
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 80,
        executionDetails: 'Arquiteto executou a tarefa',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: true
      });
      
      // Configurar doneFile existente
      mocks.fileUtils.fileExists
        .mockResolvedValueOnce(true) // Para doneFile
        .mockResolvedValueOnce(false); // Para relatorioFile
      
      // Configurar snapshot com alterações
      mocks.workspaceSnapshotService.takeSnapshot.mockResolvedValue(
        new Map([
          ['/tmp/project/file1.js', 1234567890],
          ['/tmp/project/file2.js', 1234567890],
          ['/tmp/project/file3.js', 1234567890] // Novo arquivo
        ])
      );
      
      mocks.workspaceSnapshotService.compareSnapshots.mockReturnValue({
        modified: ['/tmp/project/file1.js'],
        created: ['/tmp/project/file3.js'],
        deleted: []
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      // Deve ter verificado evidências
      expect(mocks.workspaceSnapshotService.takeSnapshot).toHaveBeenCalledWith('/tmp/project');
      expect(mocks.workspaceSnapshotService.compareSnapshots).toHaveBeenCalled();
      
      // Deve ter logado sobre evidências confirmadas
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Evidências confirmadas:')
      );
      
      // Deve usar fluxo de execução concluída
      expect(result.currentInput).toContain('EXECUÇÃO CONCLUÍDA PELO ARQUITETO');
    });
    
    it('deve corrigir análise quando não há evidências', async () => {
      // Configurar análise indicando execução
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: true,
        hasPlan: false,
        confidence: 80,
        executionDetails: 'Arquiteto executou',
        planDetails: null,
        analysisFailed: false,
        hadExecuted: false
      });
      
      // Configurar doneFile não existente e snapshot sem alterações
      mocks.fileUtils.fileExists.mockResolvedValue(false);
      mocks.workspaceSnapshotService.takeSnapshot.mockResolvedValue(mockInitialSnapshot);
      mocks.workspaceSnapshotService.compareSnapshots.mockReturnValue({
        modified: [],
        created: [],
        deleted: []
      });
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      // Deve ter logado sobre falta de evidências
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('NENHUMA evidência encontrada')
      );
      
      // Deve ter corrigido análise
      expect(result.architectAnalysis.hasExecuted).toBe(false);
      expect(result.architectAnalysis.hasPlan).toBe(true);
      
      // Deve usar fluxo com plano
      expect(result.currentInput).toContain('PLANO DE AÇÃO DO ARQUITETO');
    });
    
    it('deve manter prompt original quando análise falhar', async () => {
      // Configurar análise falha
      mocks.taskAnalysisService.analyzeArchitectResponse.mockResolvedValue({
        hasExecuted: false,
        hasPlan: false,
        confidence: 0,
        executionDetails: null,
        planDetails: null,
        analysisFailed: true
      });
      
      // Configurar plano vazio
      mocks.smartFileFinder.findRealArchitectPlan.mockResolvedValue({
        content: '',
        path: ''
      });
      
      const originalInput = 'Prompt original da tarefa';
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: originalInput
      };
      
      const result = await step.execute(context);
      
      // Deve manter prompt original
      expect(result.currentInput).toBe(originalInput);
      
      // Deve ter logado sobre resposta vazia
      expect(mocks.log).toHaveBeenCalledWith(
        expect.stringContaining('Resposta vazia ou inválida')
      );
    });
  });
  
  describe('validação de parâmetros', () => {
    it('deve falhar quando contexto incompleto', async () => {
      const context = {
        task: mockTask
        // faltam files, config, etc.
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('contexto incompleto');
    });
  });
  
  describe('tratamento de erros', () => {
    it('deve lidar com erro no OpenClawService', async () => {
      mocks.openClawService.executeWithFallback.mockRejectedValue(
        new Error('Erro no OpenClaw')
      );
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('Erro no OpenClaw');
      expect(result.shouldAbort).toBe(true);
    });
    
    it('deve lidar com erro na análise da resposta', async () => {
      mocks.taskAnalysisService.analyzeArchitectResponse.mockRejectedValue(
        new Error('Erro na análise')
      );
      
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await step.execute(context);
      
      expect(result.architectPlanningResult.success).toBe(false);
      expect(result.architectPlanningResult.error).toContain('Erro na análise');
    });
  });
  
  describe('método estático planArchitect', () => {
    it('deve funcionar corretamente via método estático', async () => {
      const context = {
        task: mockTask,
        project: mockProject,
        files: mockFiles,
        initialSnapshot: mockInitialSnapshot,
        config: mockConfig,
        analysisPlan: mockAnalysisPlan,
        commentsSection: '',
        developerPrompt: '',
        currentInput: ''
      };
      
      const result = await ArchitectPlanningStep.planArchitect(context);
      
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(mockTask.id);
    });
  });
});