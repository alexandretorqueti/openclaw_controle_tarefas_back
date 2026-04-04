// src/interfaces/interfaceMonitor.ts

import { Prisma, Project } from '@prisma/client';

// ============================================================================
// 1. TIPOS DO BANCO DE DADOS (PRISMA)
// ============================================================================

export type TaskWithProject = Prisma.TaskGetPayload<{
    include: { project: true }
}>;


export interface ContextoExecucaoMotorIA {
    // ---------------------------------------------------
    // A. Dados de Negócio (O que estamos fazendo)
    // ---------------------------------------------------
    tarefaAtual: TaskWithProject | null;
    project?: Project | null;
    UserId?: string; // ID do usuário dono da execução

    // ---------------------------------------------------
    // B. Configurações Globais e Ambiente
    // ---------------------------------------------------
    config: {
        API_URL: string;
        TASKS_DIR: string;
        ERROR_DIR: string;
        TASK_TIMEOUT_MS: number;
        [key: string]: any; // Permite outras configs sem quebrar o TS
    };

    // ---------------------------------------------------
    // C. Dependências (Serviços Injetados pelo Container)
    // ---------------------------------------------------
    services: {
        lockService?: any;
        stateService?: any;
        taskService?: any;
        openClawService?: any;
        [key: string]: any; // Flexível para não travar se você adicionar um serviço novo
    };

    // ---------------------------------------------------
    // D. Controle de Fluxo (O Motor de Parada)
    // ---------------------------------------------------
    shouldAbort?: boolean; // Se true, o motor ejeta a tarefa e para o ciclo
    abortReason?: string;  // O motivo da ejeção (ex: "Falha de Domínio")
    lockAtivo?: boolean;   // Sinaliza se há um lock impedindo a execução

    // ---------------------------------------------------
    // E. Estado Temporário (Dados trocados entre os Passos)
    // ---------------------------------------------------
    files?: {
        promptFile: string;
        doneFile: string;
        relatorioFile: string;
        architectPlanFile: string;
        architectLogFile: string;
        [key: string]: string;
    };
    initialSnapshot?: any;
    currentInput?: string;
    developerPrompt?: string;
    analysisPlan?: any;
    
    // Resultados do Arquiteto
    architectAnalysis?: any;
    architectPlan?: string;
    architectPlanningResult?: {
        success: boolean;
        error?: string | null;
        taskId?: string;
        hasArchitectPlan?: boolean;
        hasArchitectExecution?: boolean;
        confidence?: number;
        promptUpdated?: boolean;
    };

    // ---------------------------------------------------
    // F. Válvula de Escape (Flexibilidade Total)
    // ---------------------------------------------------
    // Se você colar algo novo no ctx no meio de um passo (ex: ctx.minhaVariavel = 1), 
    // o TS não vai gritar erro graças a esta linha:
    [key: string]: any; 
}

/**
 * Interface que todo Passo da esteira deve obedecer.
 * Ele tem um nome para os logs e uma função assíncrona que recebe e altera o Contexto.
 */
export interface Passo {
    name: string;
    func: (ctx: ContextoExecucaoMotorIA) => Promise<void>;
}