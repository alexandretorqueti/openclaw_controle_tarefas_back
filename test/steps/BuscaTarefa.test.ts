// test/steps/BuscaTarefa.test.ts

import { passoBuscaTarefa } from '../../src/steps/BuscaTarefa';
import { createLegacyGetNextTask } from '../../src/steps/adapters/legacyGetNextTask';

// Mockamos o módulo do adapter
jest.mock('../../src/steps/adapters/legacyGetNextTask');
beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  // (ou apenas imprimir a mensagem sem o rastro do Jest)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Passo: Busca Tarefa', () => {
    let mockContexto: any;
    let mockGetNextTask: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockContexto = {
            config: {
                API_URL: 'http://localhost:3000',
                MY_USER_NICKNAME: 'jarbas'
            },
            tarefaAtual: undefined // Começa sem tarefa
        };

        // Preparamos a função interna que o factory retorna
        mockGetNextTask = jest.fn();
        (createLegacyGetNextTask as jest.Mock).mockReturnValue(mockGetNextTask);
    });

    it('deve extrair e salvar a tarefa no contexto quando a fila tem itens', async () => {
        const tarefaMock = { id: '123', title: 'Corrigir botão' };
        mockGetNextTask.mockResolvedValue(tarefaMock);

        await passoBuscaTarefa.func(mockContexto);

        expect(createLegacyGetNextTask).toHaveBeenCalledWith('http://localhost:3000');
        expect(mockGetNextTask).toHaveBeenCalledWith('jarbas');
        expect(mockContexto.tarefaAtual).toEqual(tarefaMock);
    });

    it('deve definir tarefaAtual como null quando a fila estiver vazia', async () => {
        mockGetNextTask.mockResolvedValue(null); // API retorna vazio

        await passoBuscaTarefa.func(mockContexto);

        expect(mockContexto.tarefaAtual).toBeNull();
    });

    it('deve tratar erros da API sem quebrar e definir tarefaAtual como null', async () => {
        mockGetNextTask.mockRejectedValue(new Error('ECONNREFUSED')); // API fora do ar

        // O passo não deve lançar o erro para cima (não deve dar throw)
        await expect(passoBuscaTarefa.func(mockContexto)).resolves.not.toThrow();
        
        // Deve garantir que não há tarefa para o motor tentar processar
        expect(mockContexto.tarefaAtual).toBeNull();
    });
});


afterAll(() => {
  jest.restoreAllMocks();
});