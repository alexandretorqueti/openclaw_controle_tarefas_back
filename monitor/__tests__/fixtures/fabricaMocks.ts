// monitor/__tests__/fixtures/fabricaMocks.ts
// ─────────────────────────────────────────────────────
// Fábrica centralizada de mocks (Test Fixtures).
// Gera objetos falsos prontos para injeção nos testes.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import type {
  ServicoLock,
  ServicoEstado,
  ServicoUsuario,
  ServicoAnaliseTarefa,
  ServicoArquivosTarefa,
  FabricaPrompts,
  ConfiguracaoMonitor,
  ContextoExecucao,
  ResultadoCheckLock,
  TarefaCompleta,
} from '../../interfaces';

// ═══════════════════════════════════════════════════════
// LOGGER
// ═══════════════════════════════════════════════════════

export function criarLoggerMock(): jest.Mocked<Logger> {
  return {
    info: jest.fn().mockResolvedValue(undefined),
    erro: jest.fn().mockResolvedValue(undefined),
    debug: jest.fn().mockResolvedValue(undefined),
  };
}

// ═══════════════════════════════════════════════════════
// SERVIÇOS
// ═══════════════════════════════════════════════════════

export function criarLockServiceMock(): jest.Mocked<ServicoLock> {
  return {
    checkLock: jest.fn().mockResolvedValue({
      locked: false,
      corrupted: false,
    } satisfies ResultadoCheckLock),
    acquireLock: jest.fn().mockResolvedValue(true),
    releaseLock: jest.fn().mockResolvedValue(undefined),
    forceReleaseLock: jest.fn().mockResolvedValue(undefined),
  };
}

export function criarStateServiceMock(): jest.Mocked<ServicoEstado> {
  return {
    registerActiveTask: jest.fn().mockResolvedValue(undefined),
    clearState: jest.fn().mockResolvedValue(undefined),
    getState: jest.fn().mockResolvedValue({}),
  };
}

export function criarUserServiceMock(): jest.Mocked<ServicoUsuario> {
  return {
    getCurrentUser: jest.fn().mockResolvedValue({
      id: 'user-123',
      nickname: 'jarbas',
    }),
  };
}

export function criarTaskAnalysisServiceMock(): jest.Mocked<ServicoAnaliseTarefa> {
  return {
    analyzeTaskScope: jest.fn().mockResolvedValue({
      taskType: 'feature',
      expectedLayers: ['backend'],
    }),
  };
}

export function criarFileServiceMock(): jest.Mocked<ServicoArquivosTarefa> {
  return {
    createTaskDir: jest.fn().mockResolvedValue('/tmp/tasks/1'),
    getTaskDir: jest.fn().mockReturnValue('/tmp/tasks/1'),
  };
}

export function criarPromptFactoryMock(): jest.Mocked<FabricaPrompts> {
  return {
    gerarPromptParaVerificarAtomicidadeeDominio: jest.fn().mockReturnValue('prompt de teste'),
    gerarPromptArquiteto: jest.fn().mockReturnValue('prompt de teste'),
    gerarPromptProgramador: jest.fn().mockReturnValue('prompt de teste'),
    gerarPromptDecomposicao: jest.fn().mockReturnValue('prompt de teste'),
  };
}

// ═══════════════════════════════════════════════════════
// SERVIÇOS DE IA (LLM e OpenClaw) - SEMPRE MOCKADOS
// ═══════════════════════════════════════════════════════

export function criarServicoOpenClawMock() {
  return {
    executarTurno: jest.fn().mockResolvedValue({
      sucesso: true,
      output: '{"acao":"ok"}',
    }),
    abortar: jest.fn().mockResolvedValue(undefined),
  };
}

export function criarServicoAnalistaMock() {
  return {
    decompor: jest.fn().mockResolvedValue({
      sucesso: true,
      quantidadeSubtarefas: 2,
    }),
  };
}

// ═══════════════════════════════════════════════════════
// CONFIGURAÇÃO
// ═══════════════════════════════════════════════════════

export function criarConfigMock(
  overrides: Partial<ConfiguracaoMonitor> = {}
): ConfiguracaoMonitor {
  return {
    BASE_DIR: '/tmp/projetos',
    TASKS_DIR: '/tmp/tasks',
    PROCESSED_DIR: '/tmp/tasks/processed',
    ERROR_DIR: '/tmp/tasks/error',
    API_URL: 'http://localhost:4002',
    STATE_FILE: '/tmp/monitor-state.json',
    LOG_FILE: '/tmp/monitor.log',
    MY_USER_NICKNAME: 'jarbas',
    MAX_LOG_LINES: 100,
    TASK_TIMEOUT_MS: 30 * 60 * 1000,
    MINUTOS: 30,
    LOCK_FILE: '/tmp/.monitor.lock',
    OPENCLAW_EXECUTION_TIMEOUT_MS: 300000,
    DEBUG_TASK_ANALYSIS: false,
    DEBUG_TASK_PROMPT: false,
    DEBUG_TASK_CONTRACT: false,
    servicesConfig: {},
    STATUS: {
      IN_PROGRESS: 'Em Andamento',
      COMPLETED: 'Concluída',
    },
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// CONTEXTO COMPLETO
// ═══════════════════════════════════════════════════════

export function criarContextoMock(
  overrides: Partial<ContextoExecucao> = {}
): ContextoExecucao {
  return {
    tarefaAtual: null,
    UserId: null,
    config: criarConfigMock(),
    services: {
      lockService: criarLockServiceMock(),
      stateService: criarStateServiceMock(),
      fileService: criarFileServiceMock(),
      userService: criarUserServiceMock(),
      taskAnalysisService: criarTaskAnalysisServiceMock(),
    },
    utils: {
      promptFactory: criarPromptFactoryMock(),
    },
    lockAtivo: false,
    files: {
      promptFile: null,
      relatorioFile: null,
      doneFile: null,
      terminalLogFile: null,
      architectPlanFile: null,
      architectLogFile: null,
    },
    analysisPlan: null,
    historicoPassos: [],
    controle: {
      loopsExecutados: 0,
    },
    erros: {},
    resultados: {},
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════
// TAREFA FAKE
// ═══════════════════════════════════════════════════════

export function criarTarefaFake(
  overrides: any = {}
): TarefaCompleta {
  return {
    id: overrides.id || 1,
    title: 'Implementar login',
    description: 'Criar sistema de autenticação',
    isAtomic: true,
    domain: 'backend',
    priority: 1,
    statusId: 1,
    projectId: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: {
      id: 1,
      name: 'Projeto Teste',
      description: 'Projeto de teste',
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    comments: [],
    ...overrides,
  } as TarefaCompleta;
}
