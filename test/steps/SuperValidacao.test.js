"use strict";
// test/steps/SuperValidacao.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const SuperValidacao_1 = require("../../src/steps/SuperValidacao");
const container_1 = __importDefault(require("../../src/container"));
jest.mock('../../src/container');
jest.mock('../../src/steps/adapters/legacyTaskFailure');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Super Validação', () => {
    let mockContexto;
    let mockValidationService;
    let mockTaskService;
    beforeEach(() => {
        jest.clearAllMocks();
        mockValidationService = {
            validateWithAuxModel: jest.fn()
        };
        mockTaskService = {
            updateTask: jest.fn().mockResolvedValue(true)
        };
        container_1.default.resolve.mockImplementation((name) => {
            if (name === 'validationService')
                return mockValidationService;
            if (name === 'taskService')
                return mockTaskService;
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
                isAtomic: undefined,
                domain: null,
                project: { id: 'proj-1' }
            },
            controleTarefa: {}
        };
    });
    it('deve chamar a IA, atualizar o contexto e persistir no banco (Caminho Feliz)', async () => {
        mockValidationService.validateWithAuxModel.mockResolvedValue({
            isAtomic: true,
            domain: 'BACKEND'
        });
        await SuperValidacao_1.passoSuperValidacao.func(mockContexto);
        expect(mockValidationService.validateWithAuxModel).toHaveBeenCalledWith(mockContexto.tarefaAtual, mockContexto.tarefaAtual.project);
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
        await SuperValidacao_1.passoSuperValidacao.func(mockContexto);
        // Não deve gastar token à toa!
        expect(mockValidationService.validateWithAuxModel).not.toHaveBeenCalled();
        expect(mockTaskService.updateTask).not.toHaveBeenCalled();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
