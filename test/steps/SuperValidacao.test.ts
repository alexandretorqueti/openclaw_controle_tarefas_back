// test/steps/SuperValidacao.test.ts

import { passoSuperValidacao } from '../../src/steps/SuperValidacao';
import container from '../../src/container';
import { handleTaskFailure as legacyHandleTaskFailure } from '../../src/steps/adapters/legacyTaskFailure';

jest.mock('../../src/container');
jest.mock('../../src/steps/adapters/legacyTaskFailure');
beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  // (ou apenas imprimir a mensagem sem o rastro do Jest)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Passo: Super Validação', () => {
    let mockContexto: any;
    let mockValidationService: any;
    let mockTaskService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockValidationService = {
            validateWithAuxModel: jest.fn()
        };

        mockTaskService = {
            updateTask: jest.fn().mockResolvedValue(true)
        };

        (container.resolve as jest.Mock).mockImplementation((name) => {
            if (name === 'validationService') return mockValidationService;
            if (name === 'taskService') return mockTaskService;
            return {};
        });

        mockContexto = {
            UserId: 'user-123',
            config: {
                API_URL: 'http://api.com',
                TASKS_DIR: '/tmp/tasks',
                ERROR_DIR: '/tmp/errors'
            },
            tarefaAtual: {
                id: '123',
                isAtomic: undefined, // Simula que não sabemos ainda
                domain: null,        // Simula que não sabemos ainda
                project: { id: 'proj-1' }
            }
        };
    });

    it('deve chamar a IA, atualizar o contexto e persistir no banco (Caminho Feliz)', async () => {
        mockValidationService.validateWithAuxModel.mockResolvedValue({
            isAtomic: true,
            domain: 'BACKEND'
        });

        await passoSuperValidacao.func(mockContexto);

        expect(mockValidationService.validateWithAuxModel).toHaveBeenCalledWith(
            mockContexto.tarefaAtual, 
            mockContexto.tarefaAtual.project
        );
        
        expect(mockContexto.tarefaAtual.isAtomic).toBe(true);
        expect(mockContexto.tarefaAtual.domain).toBe('BACKEND');
        
        expect(mockTaskService.updateTask).toHaveBeenCalledWith('123', {
            isAtomic: true,
            domain: 'BACKEND'
        });
        expect(mockContexto.tarefaAtual.erroValidacao).toBeUndefined();
    });

    it('deve PULAR a validação se a tarefa já for atômica E tiver domínio', async () => {
        mockContexto.tarefaAtual.isAtomic = true;
        mockContexto.tarefaAtual.domain = 'FRONTEND';

        await passoSuperValidacao.func(mockContexto);

        // Não deve gastar token à toa!
        expect(mockValidationService.validateWithAuxModel).not.toHaveBeenCalled();
        expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });

    it('deve chamar o HandleFailure legado e anotar erroValidacao se a IA explodir', async () => {
        const errorMock = new Error('LLM Timeout');
        mockValidationService.validateWithAuxModel.mockRejectedValue(errorMock);

        await passoSuperValidacao.func(mockContexto);

        // Verifica o handler de erro sendo chamado
        expect(legacyHandleTaskFailure).toHaveBeenCalledWith(
            mockContexto.tarefaAtual,
            errorMock,
            'user-123',
            expect.objectContaining({ ERROR_DIR: '/tmp/errors' })
        );

        // Verifica a migalha pro mapa abortar a missão
        expect(mockContexto.tarefaAtual.erroValidacao).toBe(true);
    });
});

afterAll(() => {
  jest.restoreAllMocks();
});