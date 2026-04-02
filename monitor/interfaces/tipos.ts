// monitor/interfaces/tipos.ts
// ─────────────────────────────────────────────────────
// Tipagens centrais do Motor de Monitoramento.
// Nenhuma dependência externa — este é o contrato puro.
// ─────────────────────────────────────────────────────

import type { Project, Task, Prisma } from '@prisma/client';
import { Snapshot } from '../services/WorkspaceSnapshotService';
import { FaseArquitetoOutput } from '../passos/macro/FaseArquiteto';
import { AnaliseProgramadorOutput } from '../passos/macro/FaseAnaliseProgramador';

// ═══════════════════════════════════════════════════════
// 1. TAREFA E PROJETO
// ═══════════════════════════════════════════════════════

/** Tarefa com relacionamentos carregados (Prisma payload type) */
export type TarefaCompleta = Prisma.TaskGetPayload<{
  include: {
    project: true;
    comments: {
      include: {
        user: true;
        replies: {
          include: {
            user: true;
          };
        };
      };
    };
  };
}>;

// ═══════════════════════════════════════════════════════
// 2. SERVIÇOS (contratos de injeção)
// ═══════════════════════════════════════════════════════

/** Resultado da verificação de lock */
export interface ResultadoCheckLock {
  locked: boolean;
  ageRecent?: boolean;
  pid?: number;
  alive?: boolean;
  corrupted?: boolean;
  mtime?: number;
}

/** Contrato do serviço de lock */
export interface ServicoLock {
  checkLock(timeoutMs: number): Promise<ResultadoCheckLock>;
  acquireLock(taskId: number | string): Promise<boolean>;
  releaseLock(): Promise<void>;
  forceReleaseLock(): Promise<void>;
}

/** Contrato do serviço de estado do monitor */
export interface ServicoEstado {
  registerActiveTask(taskId: number | string): Promise<void>;
  clearState(): Promise<void>;
  getState(): Promise<Record<string, unknown>>;
}

/** Contrato do serviço de arquivos de tarefa */
export interface ServicoArquivosTarefa {
  createTaskDir(taskId: number | string): Promise<string>;
  getTaskDir(taskId: number | string): string;
}

/** Contrato do serviço de usuário */
export interface ServicoUsuario {
  getCurrentUser(nickname: string): Promise<{ id: string; nickname: string } | null>;
}

/** Contrato do serviço de análise de tarefa */
export interface ServicoAnaliseTarefa {
  analyzeTaskScope(task: TarefaCompleta, project: Project): Promise<PlanoDeAnalise>;
}

/** Contrato da fábrica de prompts */
export interface FabricaPrompts {
  gerarPromptParaVerificarAtomicidadeeDominio(task: TarefaCompleta): string;
  gerarPromptArquiteto(tarefa: TarefaCompleta, projeto: Project, caminhoPlano: string): string;
  gerarPromptProgramador(tarefa: TarefaCompleta, planoArquiteto: string, caminhoTaskDir: string): string;
  gerarPromptDecomposicao(tarefa: TarefaCompleta): string;
}

// ═══════════════════════════════════════════════════════
// 3. PLANO DE ANÁLISE
// ═══════════════════════════════════════════════════════

export interface PlanoDeAnalise {
  taskType?: string;
  requiresReport?: unknown;
  expectedLayers?: string[];
  requiredModifiedLayers?: string[];
  mandatoryChecks?: string[];
  definitionOfDone?: string[];
  finalizationInstructions?: string[];
  risks?: string[];
}

// ═══════════════════════════════════════════════════════
// 4. CONTROLE, ERROS E RESULTADOS (Namespaces)
// ═══════════════════════════════════════════════════════

export interface ProcessoFantasma {
  pid: number;
}

/** Estado geral de controle do ciclo */
export interface ControleGeral {
  loopsExecutados: number;
  processoFantasma?: ProcessoFantasma | null;
  shouldAbort?: boolean;
  abortReason?: string;
  taskDir?: string | null;
  promptVez?: string | null;
  agenteAlocado?: string | null;
  
  // Controle de sessão para correção iterativa
  sessaoAtiva?: boolean;
  sessaoId?: string | null;
  tentativasCorrecao?: number;
  maxTentativasCorrecao?: number;
  feedbackPendente?: string | null;
  instrucoesCorrecao?: string | null;
}

/** Flags de erro centralizadas (fáceis de checar no mapa de transições) */
export interface ErrosCiclo {
  inicializacao?: boolean;
  validacao?: boolean;
  decomposicao?: boolean;
  dominio?: boolean;
  fatalIA?: boolean;
  sintaxeJSON?: boolean;
  execucao?: boolean;
  finalizacao?: boolean;
}

/** Resultados específicos de cada passo (Evita o God Object) */
export interface ResultadosPassos {
  decomposicao?: {
    sucesso: boolean;
    subtasksCreated: number;
  };
  inspecao?: {
    doneExists: boolean;
    hasRealChanges?: boolean;
    actualDonePath?: string;
    terminalLogFile?: string;
  };
  analiseTurno?: {
    sucesso: boolean;
    feedbackForNextTurn?: string;
  };
  programador?: {
    sessionId?: string;
    rawOutput?: string;
    ultimoErro?: string;
    toolCall?: unknown;
    toolResult?: unknown;
    toolFeedback?: string;
    evidence?: unknown;
  };
  arquiteto?: {
    hasPlan: boolean;
    hasExecuted: boolean;
    confidence: number;
    planDetails?: string | null;
    analysisFailed: boolean;
  };
  resultArquiteto?: FaseArquitetoOutput;
  resultAnaliseProgramador?: AnaliseProgramadorOutput;
}

// ═══════════════════════════════════════════════════════
// 5. ARQUIVOS DE SESSÃO
// ═══════════════════════════════════════════════════════

export interface ArquivosSessao {
  promptFile: string | null;
  relatorioFile: string | null;
  doneFile: string | null;
  terminalLogFile: string | null;
  architectPlanFile: string | null;
  architectLogFile: string | null;
}

// ═══════════════════════════════════════════════════════
// 6. CONFIGURAÇÃO DO MONITOR
// ═══════════════════════════════════════════════════════

export interface ConfiguracaoMonitor {
  BASE_DIR: string;
  TASKS_DIR: string;
  PROCESSED_DIR: string;
  ERROR_DIR: string;
  API_URL: string;
  STATE_FILE: string;
  LOG_FILE: string;
  MY_USER_NICKNAME: string;
  MAX_LOG_LINES: number;
  TASK_TIMEOUT_MS: number;
  MINUTOS: number;
  LOCK_FILE: string;
  OPENCLAW_EXECUTION_TIMEOUT_MS: number;
  DEBUG_TASK_ANALYSIS: boolean;
  DEBUG_TASK_PROMPT: boolean;
  DEBUG_TASK_CONTRACT: boolean;
  servicesConfig: Record<string, unknown>;
  STATUS: {
    IN_PROGRESS: string;
    COMPLETED: string;
    FAILED: string;
  };
}

// ═══════════════════════════════════════════════════════
// 7. CONTEXTO DE EXECUÇÃO (O "sangue" do sistema)
// ═══════════════════════════════════════════════════════

export interface ContextoExecucao {
  tarefaAtual: TarefaCompleta | null;
  UserId: string | null;
  config: ConfiguracaoMonitor;
  services: ServicosDoMonitor;
  utils: UtilidadesDoMonitor;
  lockAtivo: boolean;
  project?: Project | null;
  files: ArquivosSessao;
  initialSnapshot?: Snapshot | null;
  analysisPlan: PlanoDeAnalise | null;
  developerPrompt?: string;
  currentInput?: string;
  architectPlanningResult?: ResultadoPlanejamentoArquiteto;
  
  // Trilha de auditoria embutida
  historicoPassos: string[];
  
  // Namespaces separados (evitando o God Object)
  controle: ControleGeral;
  erros: ErrosCiclo;
  resultados: ResultadosPassos;
}

export interface ServicosDoMonitor {
  lockService: ServicoLock;
  stateService: ServicoEstado;
  fileService: ServicoArquivosTarefa;
  userService: ServicoUsuario;
  taskAnalysisService: ServicoAnaliseTarefa;
}

export interface UtilidadesDoMonitor {
  promptFactory: FabricaPrompts;
}

// ═══════════════════════════════════════════════════════
// 8. RESULTADOS ESPECÍFICOS
// ═══════════════════════════════════════════════════════

export interface ResultadoPlanejamentoArquiteto {
  success: boolean;
  error?: string | null;
  taskId?: string | null;
  hasArchitectPlan?: boolean | null;
  hasArchitectExecution?: boolean | null;
  confidence?: number | null;
  promptUpdated?: boolean | null;
}

export interface AnaliseArquiteto {
  hasPlan: boolean;
  hasExecuted: boolean;
  confidence: number;
  executionDetails: unknown;
  planDetails: string | null;
  analysisFailed: boolean;
  hadExecuted?: boolean;
}

// ═══════════════════════════════════════════════════════
// 9. ROTEAMENTO
// ═══════════════════════════════════════════════════════

/** Contrato de um passo atômico simples que trabalha com Contexto (Fase 1 Legada) */
export interface Passo {
  readonly name: string;
  execute(contexto: ContextoExecucao): Promise<void>;
}
