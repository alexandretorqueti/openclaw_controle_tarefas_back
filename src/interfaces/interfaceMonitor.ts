// interfaces/interfaceMonitor.ts

export interface ContextoExecucao {
    tarefaAtual: any | null;       
    UserId: string | null;         
    config: any;                   
    services: {
        lockService: any;
        stateService: any;
        [key: string]: any; // Para futuros serviços
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