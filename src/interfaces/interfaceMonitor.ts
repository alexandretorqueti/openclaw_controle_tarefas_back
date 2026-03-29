// interfaces/interfaceMonitor.ts
import { Project, Task, Prisma } from '@prisma/client';
export type TaskComProjeto = Prisma.TaskGetPayload<{
  include: { project: true }
}>;

export interface ContextoExecucao {
    tarefaAtual?: TaskComProjeto | null;       
    UserId?: string | null;         
    config: any;                   
    services: {
        lockService: any;
        stateService: any;
        [key: string]: any; // Para futuros serviços
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
    shouldAbort?: boolean;
    abortReason?: string;
    controleExecucao?: {
        sessionId: string;
        loopsExecutados: number;
        promptVez: string;
        taskDir: string;
        falhaDeDominio: boolean;
        erroInicializacao: boolean;
        erroValidacao: boolean;
        erroDecomposicao: boolean;
        analiseConcluidaComSucesso: boolean;
        subtasksCreated?: number;
        erroFatalIA: boolean;
        feedbackForNextTurn: string | null;
        doneExists: boolean;
        erroSintaxeJSON: boolean;
        agenteAlocado?: string | null;
        erroExecucao: boolean;
        hasRealChanges: boolean;
        changesSummary?: any;
        actualDonePath?: string | null;
        evidence?: any;
        toolCall?: any;
        toolResult?: any;
        finalizadaComSucesso?: boolean;
        erroFinalizacao?: boolean;
        terminalLogFile?: string;
        rawOutput?: string;
        toolFeedback?: string | null;
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