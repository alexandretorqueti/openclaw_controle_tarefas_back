"use strict";
// test/steps/FinalizaTarefa.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const FinalizaTarefa_1 = require("../../src/steps/FinalizaTarefa");
const container_1 = __importDefault(require("../../src/container"));
jest.mock('../../src/container');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Finaliza Tarefa', () => {
    let mockContexto;
    let mockFileSystem;
    let mockPath;
    let mockTaskService;
    beforeEach(() => {
        jest.clearAllMocks();
        // Mocks dos serviços do container
        mockFileSystem = {
            unlink: jest.fn().mockResolvedValue(undefined),
            mkdir: jest.fn().mockResolvedValue(undefined),
            rename: jest.fn().mockResolvedValue(undefined)
        };
        mockPath = {
            join: jest.fn((dir, id) => `${dir}/${id}`)
        };
        mockTaskService = {
            updateTask: jest.fn().mockResolvedValue(true)
        };
        container_1.default.resolve.mockImplementation((name) => {
            if (name === 'fileSystem')
                return mockFileSystem;
            if (name === 'path')
                return mockPath;
            if (name === 'taskService')
                return mockTaskService;
            return {};
        });
        // Estado inicial do contexto
        mockContexto = {
            UserId: 'user-789',
            config: {
                TASKS_DIR: '/tmp/pending',
                PROCESSED_DIR: '/tmp/processed'
            },
            tarefaAtual: {
                id: 'task-123',
            },
            controleExecucao: {
                actualDonePath: '/tmp/pending/task-123/.done'
            }
        };
    });
    it('deve realizar a limpeza, atualizar a API e mover a pasta (Caminho Feliz)', async () => {
        await FinalizaTarefa_1.passoFinalizaTarefa.func(mockContexto);
        // Verifica limpeza
        expect(mockFileSystem.unlink).toHaveBeenCalledWith('/tmp/pending/task-123/.done');
        // Verifica atualização da API
        expect(mockTaskService.updateTask).toHaveBeenCalledWith('task-123', expect.objectContaining({
            status: 'COMPLETED',
            completedBy: 'user-789'
        }));
        // Verifica movimentação da pasta
        expect(mockFileSystem.mkdir).toHaveBeenCalledWith('/tmp/processed', { recursive: true });
        expect(mockFileSystem.rename).toHaveBeenCalledWith('/tmp/pending/task-123', '/tmp/processed/task-123');
        // Verifica migalha
        expect(mockContexto.controleExecucao.finalizadaComSucesso).toBe(true);
        expect(mockContexto.controleExecucao.erroFinalizacao).toBeUndefined();
    });
    it('deve ignorar a exclusão do .done se o caminho não existir no contexto', async () => {
        mockContexto.controleExecucao.actualDonePath = undefined;
        await FinalizaTarefa_1.passoFinalizaTarefa.func(mockContexto);
        expect(mockFileSystem.unlink).not.toHaveBeenCalled();
        expect(mockTaskService.updateTask).toHaveBeenCalled(); // O resto deve rodar normal
    });
    it('deve marcar erroFinalizacao e NÃO mover a pasta se a atualização da API falhar', async () => {
        // Simulando queda na API
        mockTaskService.updateTask.mockRejectedValue(new Error('API Offline'));
        await FinalizaTarefa_1.passoFinalizaTarefa.func(mockContexto);
        // O unlink (limpeza) acontece antes, então ele roda
        expect(mockFileSystem.unlink).toHaveBeenCalled();
        // A movimentação da pasta NÃO deve acontecer
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
        // A migalha de erro deve ser plantada
        expect(mockContexto.controleExecucao.erroFinalizacao).toBe(true);
        expect(mockContexto.controleExecucao.finalizadaComSucesso).toBeUndefined();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
