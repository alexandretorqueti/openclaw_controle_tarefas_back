"use strict";
// test/steps/BuscaTarefa.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const BuscaTarefa_1 = require("../../src/steps/BuscaTarefa");
const legacyGetNextTask_1 = require("../../src/steps/adapters/legacyGetNextTask");
// Mockamos o módulo do adapter
jest.mock('../../src/steps/adapters/legacyGetNextTask');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Busca Tarefa', () => {
    let mockContexto;
    let mockGetNextTask;
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
        legacyGetNextTask_1.createLegacyGetNextTask.mockReturnValue(mockGetNextTask);
    });
    it('deve extrair e salvar a tarefa no contexto quando a fila tem itens', async () => {
        const tarefaMock = { id: '123', title: 'Corrigir botão' };
        mockGetNextTask.mockResolvedValue(tarefaMock);
        await BuscaTarefa_1.passoBuscaTarefa.func(mockContexto);
        expect(legacyGetNextTask_1.createLegacyGetNextTask).toHaveBeenCalledWith('http://localhost:3000');
        expect(mockGetNextTask).toHaveBeenCalledWith('jarbas');
        expect(mockContexto.tarefaAtual).toEqual(tarefaMock);
    });
    it('deve definir tarefaAtual como null quando a fila estiver vazia', async () => {
        mockGetNextTask.mockResolvedValue(null); // API retorna vazio
        await BuscaTarefa_1.passoBuscaTarefa.func(mockContexto);
        expect(mockContexto.tarefaAtual).toBeNull();
    });
    it('deve tratar erros da API sem quebrar e definir tarefaAtual como null', async () => {
        mockGetNextTask.mockRejectedValue(new Error('ECONNREFUSED')); // API fora do ar
        // O passo não deve lançar o erro para cima (não deve dar throw)
        await expect(BuscaTarefa_1.passoBuscaTarefa.func(mockContexto)).resolves.not.toThrow();
        // Deve garantir que não há tarefa para o motor tentar processar
        expect(mockContexto.tarefaAtual).toBeNull();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
