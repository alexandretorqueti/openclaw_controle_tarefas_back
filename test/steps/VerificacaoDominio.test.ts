// test/steps/VerificacaoDominio.test.ts

import { passoVerificacaoDominio } from '../../src/steps/VerificacaoDominio';
import { handleTaskFailure as legacyHandleTaskFailure } from '../../src/steps/adapters/legacyTaskFailure';

// Mock do adaptador legado
jest.mock('../../src/steps/adapters/legacyTaskFailure');

describe('Passo: Verificação de Domínio', () => {
    let mockContexto: any;

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
        await passoVerificacaoDominio.func(mockContexto);

        // Verifica se a rotina de falha foi chamada corretamente
        expect(legacyHandleTaskFailure).toHaveBeenCalledWith(
            mockContexto.tarefaAtual,
            expect.any(Error),
            'user-456',
            expect.objectContaining({ ERROR_DIR: '/tmp/errors' })
        );
        
        // Verifica a migalha vital
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBe(true);
    });

    it('deve manter a flag falhaDeDominio MESMO SE a limpeza legada falhar (Resiliência)', async () => {
        // Simulando erro na movimentação da pasta ou API
        (legacyHandleTaskFailure as jest.Mock).mockRejectedValue(new Error('Directory locked'));

        // Não deve explodir o monitor
        await expect(passoVerificacaoDominio.func(mockContexto)).resolves.not.toThrow();
        
        // A flag DEVE estar lá para o mapa interromper o ciclo
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBe(true);
    });

    it('não deve fazer nada e manter as flags limpas se o domínio existir (Caminho Feliz)', async () => {
        mockContexto.tarefaAtual.domain = 'FRONTEND'; // Tem domínio válido

        await passoVerificacaoDominio.func(mockContexto);

        // O adaptador de erro não deve ser chamado
        expect(legacyHandleTaskFailure).not.toHaveBeenCalled();
        
        // A flag de falha não deve existir
        expect(mockContexto.tarefaAtual.falhaDeDominio).toBeUndefined();
    });
});