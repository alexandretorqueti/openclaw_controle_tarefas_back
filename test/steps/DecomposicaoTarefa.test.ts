// test/steps/DecomposicaoTarefa.test.ts

import { passoDecomposicaoTarefa } from '../../src/steps/DecomposicaoTarefa';
import { createLegacyCallAnalyst } from '../../src/steps/adapters/legacyCallAnalyst';

// Mockamos a fábrica do adaptador
jest.mock('../../src/steps/adapters/legacyCallAnalyst');

describe('Passo: Decomposição de Tarefa', () => {
    let mockContexto: any;
    let mockCallAnalyst: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Preparamos o mock do adaptador
        mockCallAnalyst = jest.fn();
        (createLegacyCallAnalyst as jest.Mock).mockReturnValue(mockCallAnalyst);

        // Estado inicial do contexto
        mockContexto = {
            UserId: 'user-789',
            tarefaAtual: {
                id: 'task-123',
                title: 'Criar sistema de login'
            }
        };
    });

    it('deve registrar sucesso e a quantidade de subtarefas criadas (Caminho Feliz)', async () => {
        // Simulamos o Analista retornando 3 subtarefas
        mockCallAnalyst.mockResolvedValue({ success: true, subtasksCreated: 3 });

        await passoDecomposicaoTarefa.func(mockContexto);

        // Verifica se a fábrica foi chamada com o UserId
        expect(createLegacyCallAnalyst).toHaveBeenCalledWith('user-789');
        // Verifica se a função final foi chamada passando a tarefa
        expect(mockCallAnalyst).toHaveBeenCalledWith(mockContexto.tarefaAtual);
        
        // Verifica as "migalhas" deixadas para o Mapa
        expect(mockContexto.tarefaAtual.analiseConcluidaComSucesso).toBe(true);
        expect(mockContexto.tarefaAtual.subtasksCreated).toBe(3);
        expect(mockContexto.tarefaAtual.erroDecomposicao).toBeUndefined(); // Não deve ter flag de erro
    });

    it('deve sinalizar corretamente quando o Analista falha em criar subtarefas (Fallback)', async () => {
        // Simulamos o Analista rodando, mas devolvendo 0 tarefas
        mockCallAnalyst.mockResolvedValue({ success: true, subtasksCreated: 0 });

        await passoDecomposicaoTarefa.func(mockContexto);

        expect(mockContexto.tarefaAtual.analiseConcluidaComSucesso).toBe(true);
        expect(mockContexto.tarefaAtual.subtasksCreated).toBe(0);
        expect(mockContexto.tarefaAtual.erroDecomposicao).toBeUndefined();
    });

    it('deve capturar erros da API/LLM e sinalizar a flag de erro (Aborta Missão)', async () => {
        // Simulamos um timeout ou erro na IA do Analista
        mockCallAnalyst.mockRejectedValue(new Error('LLM Timeout'));

        // O passo não deve quebrar o loop do monitor (não deve dar throw)
        await expect(passoDecomposicaoTarefa.func(mockContexto)).resolves.not.toThrow();

        // A flag de erro DEVE estar lá para o Mapa encerrar o ciclo
        expect(mockContexto.tarefaAtual.erroDecomposicao).toBe(true);
    });

    it('não deve fazer nada se não houver tarefaAtual no contexto', async () => {
        mockContexto.tarefaAtual = null;

        await passoDecomposicaoTarefa.func(mockContexto);

        // O adaptador nem deve ser chamado
        expect(createLegacyCallAnalyst).not.toHaveBeenCalled();
    });
});