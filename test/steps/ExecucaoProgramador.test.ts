// test/steps/ExecucaoProgramador.test.ts

import { passoExecucaoProgramador } from '../../src/steps/ExecucaoProgramador';

describe('Passo: Execução Programador (Alocação de Agente)', () => {
    let mockContexto: any;

    beforeEach(() => {
        mockContexto = {
            tarefaAtual: {
                id: 'task-123',
                domain: 'BACKEND',
                project: {
                    programadorBack: 'agent-senior-node',
                    programadorFront: 'agent-senior-react'
                }
            }
        };
    });

    it('deve alocar o agente de BACKEND configurado no projeto', async () => {
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.tarefaAtual.agenteAlocado).toBe('agent-senior-node');
        expect(mockContexto.tarefaAtual.loopsExecutados).toBe(0);
        expect(mockContexto.tarefaAtual.erroExecucao).toBeUndefined();
    });

    it('deve alocar o agente de FRONTEND configurado no projeto', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND';
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.tarefaAtual.agenteAlocado).toBe('agent-senior-react');
    });

    it('deve usar o agente default de BACKEND se o projeto não tiver um configurado', async () => {
        mockContexto.tarefaAtual.project = null;
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.tarefaAtual.agenteAlocado).toBe('default-backend-agent');
    });

    it('deve usar o agente default de FRONTEND se o projeto não tiver um configurado', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND';
        mockContexto.tarefaAtual.project = null;
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.tarefaAtual.agenteAlocado).toBe('default-frontend-agent');
    });

    it('deve marcar erroExecucao se o domínio for inválido ou ausente', async () => {
        mockContexto.tarefaAtual.domain = 'FULLSTACK_NAO_SUPORTADO';
        
        await passoExecucaoProgramador.func(mockContexto);

        expect(mockContexto.tarefaAtual.agenteAlocado).toBeUndefined();
        expect(mockContexto.tarefaAtual.erroExecucao).toBe(true);
    });

    it('não deve fazer nada se não houver tarefaAtual no contexto', async () => {
        mockContexto.tarefaAtual = null;
        
        await expect(passoExecucaoProgramador.func(mockContexto)).resolves.not.toThrow();
    });
});