// test/steps/DecomposicaoTarefa.test.ts

import { passoDecomposicaoTarefa } from '../../src/steps/DecomposicaoTarefa';
import { createLegacyCallAnalyst } from '../../src/steps/adapters/legacyCallAnalyst';

// Mockamos a fábrica do adaptador
jest.mock('../../src/steps/adapters/legacyCallAnalyst');
beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  // (ou apenas imprimir a mensagem sem o rastro do Jest)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Passo: Decomposição de Tarefa', () => {
    let mockContexto: any;
    let mockCallAnalyst: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        // 1. Preparamos o mock do adaptador
        mockCallAnalyst = jest.fn();
        (createLegacyCallAnalyst as jest.Mock).mockReturnValue(mockCallAnalyst);

        // 2. Montamos o contexto UMA ÚNICA VEZ
        mockContexto = {
            UserId: 'user-789',
            tarefaAtual: {
                id: 'task-123',
                title: 'Criar sistema de login'
            },
            controleExecucao: {
                // Inicia limpo/falso, como seria na vida real antes do passo rodar
                analiseConcluidaComSucesso: false,
                subtasksCreated: 0,
                erroDecomposicao: false
            }
        };
    });

    it('deve registrar sucesso e a quantidade de subtarefas criadas (Caminho Feliz)', async () => {
        // ARRANGE (Preparar)
        // Simulamos o Analista (a IA) retornando um array com 3 subtarefas "fake"
        mockCallAnalyst.mockResolvedValue({
            success: true,
            subtasksCreated: 3
        });

        // ACT (Agir)
        await passoDecomposicaoTarefa.func(mockContexto);

        // ASSERT (Verificar)
        // Verifica se chamou as funções corretas
        expect(createLegacyCallAnalyst).toHaveBeenCalledWith('user-789');
        expect(mockCallAnalyst).toHaveBeenCalledWith(mockContexto.tarefaAtual);
        
        // VERIFICA AS MIGALHAS NO LUGAR CERTO (controleExecucao, não tarefaAtual)
        // É o seu passo quem deve ter alterado esses valores para true e 3!
        expect(mockContexto.controleExecucao.analiseConcluidaComSucesso).toBe(true);
        expect(mockContexto.controleExecucao.subtasksCreated).toBe(3);
        
        // Opcional: dependendo de como você programou o passo, pode ser false ou undefined
        expect(mockContexto.controleExecucao.erroDecomposicao).toBeFalsy(); 
    });


    it('deve capturar erros da API/LLM e sinalizar a flag de erro (Aborta Missão)', async () => {
        // Simulamos um timeout ou erro na IA do Analista
        mockCallAnalyst.mockRejectedValue(new Error('LLM Timeout'));

        // O passo não deve quebrar o loop do monitor (não deve dar throw)
        await expect(passoDecomposicaoTarefa.func(mockContexto)).resolves.not.toThrow();

        // A flag de erro DEVE estar lá para o Mapa encerrar o ciclo
        expect(mockContexto.controleExecucao.erroDecomposicao).toBe(true);
    });

    it('não deve fazer nada se não houver tarefaAtual no contexto', async () => {
        mockContexto.tarefaAtual = null;

        await passoDecomposicaoTarefa.func(mockContexto);

        // O adaptador nem deve ser chamado
        expect(createLegacyCallAnalyst).not.toHaveBeenCalled();
    });
});


afterAll(() => {
  jest.restoreAllMocks();
});