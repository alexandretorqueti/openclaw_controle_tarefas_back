// config/workflowMap.ts
import { Rota } from '../interfaces/interfaceMonitor';

export const mapaDeTransicoes: Record<string, Rota[]> = {
    
    'Verifica Lock': [
        { to: 'Configura Usuário' }
    ],

    'Configura Usuário': [
        { to: 'Busca Tarefa' }
    ],

    'Busca Tarefa': [
        { condition: (c) => !c.tarefaAtual, to: null }, // Para se não houver fila
        { to: 'Inicializa Tarefa' }
    ],

    'Inicializa Tarefa': [
        // Se falhou no lock ou no disco, encerra (para o finally liberar o que der)
        { condition: (c) => c.tarefaAtual?.erroInicializacao === true, to: null },
        { to: 'Super Validação' }
    ],

    'Super Validação': [
        { condition: (c) => c.tarefaAtual.erroValidacao === true, to: null },
        { condition: (c) => c.tarefaAtual.isAtomic === false, to: 'Decomposição de Tarefa' },
        { condition: (c) => !c.tarefaAtual.domain, to: 'Verificação de Domínio' }, 
        { to: 'Execução Programador' } 
    ],

    'Decomposição de Tarefa': [
        { condition: (c) => c.tarefaAtual.erroDecomposicao === true, to: null },
        { condition: (c) => c.tarefaAtual.analiseConcluidaComSucesso && c.tarefaAtual.subtasksCreated > 0, to: null },
        { to: 'Verificação de Domínio' }
    ],

    'Verificação de Domínio': [
        { condition: (c) => c.tarefaAtual.falhaDeDominio === true, to: null },
        { to: 'Prepara Sessão e Prompt Inicial' }
    ],

    'Execução Programador': [
        // Rota direta caso o domínio já esteja verificado
        { to: 'Prepara Sessão e Prompt Inicial' }
    ],

    'Prepara Sessão e Prompt Inicial': [
        { to: 'Executa OpenClaw' }
    ],

    'Executa OpenClaw': [
        { condition: (c) => c.tarefaAtual.erroFatalIA === true, to: null },
        { condition: (c) => c.tarefaAtual.loopsExecutados > 5, to: null }, // Eject por segurança
        { to: 'Inspeciona Workspace' }
    ],

   'Inspeciona Workspace': [
        { to: 'Analisa Turno e Feedback' }
    ],

    'Analisa Turno e Feedback': [
        // Sucesso Total
        { 
            condition: (c) => c.tarefaAtual.doneExists && !c.tarefaAtual.feedbackForNextTurn, 
            to: 'Finaliza Tarefa' 
        },
        // Loop de Feedback/Erro de Sintaxe
        { 
            condition: (c) => c.tarefaAtual.feedbackForNextTurn !== null || c.tarefaAtual.erroSintaxeJSON, 
            to: 'Prepara Prompt de Correção' 
        },
        { to: null }
    ],

    'Prepara Prompt de Correção': [
        { to: 'Executa OpenClaw' }
    ],

    'Finaliza Tarefa': [
        { to: null }
    ]
};