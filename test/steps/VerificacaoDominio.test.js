"use strict";
// test/steps/VerificacaoDominio.test.ts
Object.defineProperty(exports, "__esModule", { value: true });
const VerificacaoDominio_1 = require("../../src/steps/VerificacaoDominio");
const legacyTaskFailure_1 = require("../../src/steps/adapters/legacyTaskFailure");
// Mock do adaptador legado
jest.mock('../../src/steps/adapters/legacyTaskFailure');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Verificação de Domínio', () => {
    let mockContexto;
    beforeEach(() => {
        jest.clearAllMocks();
        mockContexto = {
            UserId: 'user-456',
            config: {
                API_URL: 'http://api.com',
                TASKS_DIR: '/tmp/tasks',
                ERROR_DIR: '/tmp/errors'
            },
            tarefaAtual: {
                id: 'task-789',
                domain: undefined // Começa sem domínio para testar a falha
            }
        };
    });
    it('deve sinalizar falhaDeDominio e chamar a limpeza se não houver domínio', async () => {
        await VerificacaoDominio_1.passoVerificacaoDominio.func(mockContexto);
        // Verifica se a rotina de falha foi chamada corretamente
        expect(legacyTaskFailure_1.handleTaskFailure).toHaveBeenCalledWith(mockContexto.tarefaAtual, expect.any(Error), 'user-456', expect.objectContaining({ ERROR_DIR: '/tmp/errors' }));
        // Verifica a migalha vital
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBe(true);
    });
    it('deve manter a flag falhaDeDominio MESMO SE a limpeza legada falhar (Resiliência)', async () => {
        // Simulando erro na movimentação da pasta ou API
        legacyTaskFailure_1.handleTaskFailure.mockRejectedValue(new Error('Directory locked'));
        // Não deve explodir o monitor
        await expect(VerificacaoDominio_1.passoVerificacaoDominio.func(mockContexto)).resolves.not.toThrow();
        // A flag DEVE estar lá para o mapa interromper o ciclo
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBe(true);
    });
    it('não deve fazer nada e manter as flags limpas se o domínio existir (Caminho Feliz)', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND'; // Tem domínio válido
        await VerificacaoDominio_1.passoVerificacaoDominio.func(mockContexto);
        // O adaptador de erro não deve ser chamado
        expect(legacyTaskFailure_1.handleTaskFailure).not.toHaveBeenCalled();
        // A flag de falha não deve existir
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBeUndefined();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
