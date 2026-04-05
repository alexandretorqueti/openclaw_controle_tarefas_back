// interfaces/interfaceMonitor.ts
import { Project, Task, Prisma } from '@prisma/client';
export type TaskComplet = Prisma.TaskGetPayload<{
  include: { 
    project: true
    comments: true;
  }
}
 >;

export interface AnalysisPlan {
    taskType?: string;
    requiresReport?: any | null;
    expectedLayers?: string[];
    requiredModifiedLayers?: string[];
    mandatoryChecks?: string[];
    definitionOfDone?: string[];
    finalizationInstructions?: string[];
    risks?: string[];
}

export interface ContextoExecucao {
    tarefaAtual?: TaskComplet | null;
    UserId?: string | null;         
    config: {
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
        servicesConfig: {
            
        }
        STATUS: {
            IN_PROGRESS: string;
            COMPLETED: string;
        };
        MINUTOS: number;
        LOCK_FILE: string;
        OPENCLAW_EXECUTION_TIMEOUT_MS: number;
        DEBUG_TASK_ANALYSIS: boolean;
        DEBUG_TASK_PROMPT: boolean;
        DEBUG_TASK_CONTRACT: boolean;
    };                   
    services: {
        lockService: any;
        stateService: any;
        fileService: any;
        userService: any;
        taskAnalysisService: any;
    };
    utils: {
        promptFactory: any;
    };
    lockAtivo?: boolean;
    project?: Project | null;
    files?: {
        architectLogFile: string;
        architectPlanFile: string;
        doneFile: string;
        relatorioFile: string;
        promptFile: string;
        terminalLogFile: string;
    };
    initialSnapshot?: any | null;
    analysisPlan?: AnalysisPlan | null;
    developerPrompt?: string;
    currentInput?: string;
    architectPlanningResult?: {
        success: boolean;
        error?: string | null;
        taskId?: string | null;
        hasArchitectPlan?: boolean | null;
        hasArchitectExecution?: boolean | null;
        confidence?: number | null;
        promptUpdated?: boolean | null;
    }
    architectAnalysis?: {
        hasPlan: boolean;
        hasExecuted: boolean;
        confidence: number;
        executionDetails: any;
        planDetails: string | null;
        analysisFailed: boolean;
        hadExecuted?: boolean;
    },
    architectPlan?: string | null;
    architectExecution?: string | null;    
    controleExecucao?: {
        abortReason?: string;
        actualDonePath?: string | null;
        analiseConcluidaComSucesso?: boolean | null;
        agenteAlocado?: string | null;
        changesSummary?: any | null;
        doneExists?: boolean | null;
        erroDecomposicao?: boolean | null;
        erroExecucao?: boolean | null;
        erroFatalIA?: boolean | null;
        erroFinalizacao?: boolean | null;
        erroInicializacao?: boolean | null;
        erroSintaxeJSON?: boolean | null;
        erroValidacao?: boolean | null;
        evidence?: any | null;
        falhaDeDominio?: boolean | null;
        feedbackForNextTurn?: string | null;
        finalizadaComSucesso?: boolean | null;
        hasRealChanges?: boolean | null;
        loopsExecutados?: number | null;
        processoFantasma?: {
            pid: number;
        } | null;
        promptVez?: string | null;
        rawOutput?: string | null;
        sessionId?: string | null;
        shouldAbort?: boolean;
        subtasksCreated?: number | null;
        taskDir?: string | null;
        terminalLogFile?: string | null;
        toolCall?: any | null;
        toolFeedback?: string | null;
        toolResult?: any | null;
        ultimoErro?: string | null;
    };
}
 
export interface Passo {
    name: string;
    func: (contexto: ContextoExecucao) => Promise<void>;
}

// --- Novas Tipagens do Motor de Roteamento ---

// Uma função que olha para o contexto e devolve true/false
export type CondicaoDeRota = (ctx: ContextoExecucao) => boolean;

export interface Rota {
    // Para onde ir. Se for null, o ciclo de execução acaba.
    to: string | null;            
    // A regra para ir por este caminho (opcional. Se não tiver, é o fallback padrão)
    condition?: CondicaoDeRota;   
}