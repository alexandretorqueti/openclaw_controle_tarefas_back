"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapaDeTransicoes = void 0;
exports.mapaDeTransicoes = {
    'Verifica Lock': [
        { to: 'Configura Usuário' }
    ],
    'Configura Usuário': [
        { to: 'Busca Tarefa' }
    ],
    'Busca Tarefa': [
        { condition: (c) => !c.tarefaAtual, to: null },
        { to: 'Inicializa Tarefa' }
    ],
    'Inicializa Tarefa': [
        // Se falhou no lock ou no disco, encerra (para o finally liberar o que der)
        { condition: (c) => c.controleExecucao?.erroInicializacao === true, to: null },
        { to: 'Super Validação' }
    ],
    'Super Validação': [
        { condition: (c) => c.controleExecucao.erroValidacao === true, to: null },
        { condition: (c) => c.tarefaAtual.isAtomic === false, to: 'Decomposição de Tarefa' },
        { condition: (c) => !c.tarefaAtual.domain, to: 'Verificação de Domínio' },
        { to: 'Prepara para Programador' }
    ],
    'Decomposição de Tarefa': [
        { condition: (c) => c.controleExecucao.erroDecomposicao === true, to: null },
        { condition: (c) => c.controleExecucao.analiseConcluidaComSucesso && c.controleExecucao.subtasksCreated > 0, to: null },
        { to: 'Verificação de Domínio' }
    ],
    'Verificação de Domínio': [
        { condition: (c) => c.controleExecucao.falhaDeDominio === true, to: null },
        { to: 'Prepara Sessão e Prompt para Programador' }
    ],
    'Prepara para Programador': [
        // Rota direta caso o domínio já esteja verificado
        { to: 'Prepara Sessão e Prompt para Programador' }
    ],
    'Prepara Sessão e Prompt para Programador': [
        { to: 'Executa OpenClaw' }
    ],
    'Executa OpenClaw': [
        { condition: (c) => c.controleExecucao.erroFatalIA === true, to: null },
        { condition: (c) => c.controleExecucao.loopsExecutados > 5, to: null },
        { to: 'Inspeciona Workspace' }
    ],
    'Inspeciona Workspace': [
        { to: 'Analisa Turno e Feedback' }
    ],
    'Analisa Turno e Feedback': [
        // Sucesso Total
        {
            condition: (c) => c.controleExecucao.doneExists && !c.controleExecucao.feedbackForNextTurn,
            to: 'Finaliza Tarefa'
        },
        // Loop de Feedback/Erro de Sintaxe
        {
            condition: (c) => c.controleExecucao.feedbackForNextTurn !== null || c.controleExecucao.erroSintaxeJSON,
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
