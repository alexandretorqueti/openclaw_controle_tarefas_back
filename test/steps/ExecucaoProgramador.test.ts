import { passoExecucaoProgramador } from '../../src/steps/ExecucaoProgramador';

// Mock do logger para não sujar o terminal do teste
jest.mock('../../src/aux/logger', () => ({
    log: jest.fn()
}));

describe('Passo: Execução Programador (Alocação de Agente)', () => {
    let mockContexto: any;

    beforeEach(() => {
        // Inicializamos o contexto com a estrutura correta esperada pelo Passo
        mockContexto = {
            tarefaAtual: {
                id: 'task-123',
                domain: 'BACKEND',
                project: {
                    programadorBack: 'agent-senior-node',
                    programadorFront: 'agent-senior-react'
                }
            },
            // IMPORTANTE: O Passo espera que este objeto exista
            controleExecucao: {
                agenteAlocado: null,
                loopsExecutados: null,
                erroExecucao: false
            }
        };
    });

    it('deve alocar o agente de BACKEND configurado no projeto', async () => {
        await passoExecucaoProgramador.func(mockContexto);

        // ALVO CORRIGIDO: controleExecucao, não tarefaAtual
        expect(mockContexto.controleExecucao.agenteAlocado).toBe('agent-senior-node');
        expect(mockContexto.controleExecucao.loopsExecutados).toBe(0);
        expect(mockContexto.controleExecucao.erroExecucao).toBeFalsy();
    });

    it('deve alocar o agente de FRONTEND configurado no projeto', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND';
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.controleExecucao.agenteAlocado).toBe('agent-senior-react');
    });

    it('deve usar o agente default de BACKEND se o projeto não tiver um configurado', async () => {
        mockContexto.tarefaAtual.project = null;
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.controleExecucao.agenteAlocado).toBe('default-backend-agent');
    });

    it('deve usar o agente default de FRONTEND se o projeto não tiver um configurado', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND';
        mockContexto.tarefaAtual.project = null;
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.controleExecucao.agenteAlocado).toBe('default-frontend-agent');
    });

    it('deve marcar erroExecucao se o domínio for inválido ou ausente', async () => {
        mockContexto.tarefaAtual.domain = 'FULLSTACK_NAO_SUPORTADO';
        
        await passoExecucaoProgramador.func(mockContexto);

        // ALVO CORRIGIDO
        expect(mockContexto.controleExecucao.agenteAlocado).toBeNull();
        expect(mockContexto.controleExecucao.erroExecucao).toBe(true);
    });

    it('não deve fazer nada se não houver tarefaAtual no contexto', async () => {
        mockContexto.tarefaAtual = null;
        
        await expect(passoExecucaoProgramador.func(mockContexto)).resolves.not.toThrow();
        expect(mockContexto.controleExecucao.agenteAlocado).toBeNull();
    });
});