// interfaces/interfaceMonitor.ts
import { Project, Task, Prisma } from '@prisma/client';
export type TaskComProjeto = Prisma.TaskGetPayload<{
  include: { project: true }
}>;

export interface ContextoExecucao {
    tarefaAtual?: TaskComProjeto | null;
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
    };
    lockAtivo?: boolean;
    project?: Project | null;
    files?: {
        architectLogFile: string;
        architectPlanFile: string;
        doneFile: string;
        relatorioFile: string;
        promptFile: string;
    };
    initialSnapshot?: any | null;
    analysisPlan?: any | null;
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
        sessionId?: string | null;
        loopsExecutados?: number | null;
        promptVez?: string | null;
        taskDir?: string | null;
        falhaDeDominio?: boolean | null;
        erroInicializacao?: boolean | null;
        erroValidacao?: boolean | null;
        erroDecomposicao?: boolean | null;
        analiseConcluidaComSucesso?: boolean | null;
        subtasksCreated?: number | null;
        erroFatalIA?: boolean | null;
        feedbackForNextTurn?: string | null;
        doneExists?: boolean | null;
        erroSintaxeJSON?: boolean | null;
        agenteAlocado?: string | null;
        erroExecucao?: boolean | null;
        hasRealChanges?: boolean | null;
        changesSummary?: any | null;
        actualDonePath?: string | null;
        evidence?: any | null;
        toolCall?: any | null;
        toolResult?: any | null;
        finalizadaComSucesso?: boolean | null;
        erroFinalizacao?: boolean | null;
        terminalLogFile?: string | null;
        rawOutput?: string | null;
        toolFeedback?: string | null;
        ultimoErro?: string | null;
        processoFantasma?: {
            pid: number;
        } | null;
        shouldAbort?: boolean;
        abortReason?: string;
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