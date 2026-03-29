"use strict";
// test/steps/InicializaTarefa.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const InicializaTarefa_1 = require("../../src/steps/InicializaTarefa");
const container_1 = __importDefault(require("../../src/container"));
const axios_1 = __importDefault(require("axios"));
jest.mock('../../src/container');
jest.mock('axios');
const mockedAxios = axios_1.default;
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Inicializa Tarefa', () => {
    let mockContexto;
    let mockLockService;
    let mockStateService;
    let mockFileSystem;
    let mockPath;
    beforeEach(() => {
        jest.clearAllMocks();
        mockLockService = { acquireLock: jest.fn().mockResolvedValue(true) };
        mockStateService = { registerActiveTask: jest.fn() };
        mockFileSystem = { mkdir: jest.fn().mockResolvedValue(true) };
        mockPath = { join: jest.fn((dir, id) => `${dir}/${id}`) };
        container_1.default.resolve.mockImplementation((name) => {
            if (name === 'fileSystem')
                return mockFileSystem;
            if (name === 'path')
                return mockPath;
            return undefined; // Deixa o axios assumir a API
        });
        mockContexto = {
            config: {
                TASKS_DIR: '/tmp/tasks',
                API_URL: 'http://api.com',
                STATUS: { IN_PROGRESS: 'Em Andamento' }
            },
            services: {
                lockService: mockLockService,
                stateService: mockStateService
            },
            tarefaAtual: {
                id: '123'
            }
        };
    });
    it('deve adquirir lock, criar pasta e atualizar status na API (Caminho Feliz)', async () => {
        mockedAxios.get.mockResolvedValue({ data: { statuses: [{ id: 2, name: 'Em Andamento' }] } });
        mockedAxios.put.mockResolvedValue({});
        await InicializaTarefa_1.passoInicializaTarefa.func(mockContexto);
        expect(mockLockService.acquireLock).toHaveBeenCalledWith('123');
        expect(mockStateService.registerActiveTask).toHaveBeenCalledWith('123');
        expect(mockFileSystem.mkdir).toHaveBeenCalledWith('/tmp/tasks/123', { recursive: true });
        expect(mockedAxios.put).toHaveBeenCalledWith('http://api.com/api/tasks/123', { statusId: 2 });
        expect(mockContexto.tarefaAtual.taskDir).toBe('/tmp/tasks/123');
        expect(mockContexto.tarefaAtual.erroInicializacao).toBeUndefined();
    });
    it('deve abortar e sinalizar erro se falhar ao adquirir o lock', async () => {
        mockLockService.acquireLock.mockResolvedValue(false);
        await InicializaTarefa_1.passoInicializaTarefa.func(mockContexto);
        // A execução deve parar imediatamente após a falha do lock
        expect(mockStateService.registerActiveTask).not.toHaveBeenCalled();
        expect(mockFileSystem.mkdir).not.toHaveBeenCalled();
        expect(mockedAxios.put).not.toHaveBeenCalled();
        expect(mockContexto.tarefaAtual.erroInicializacao).toBe(true);
    });
    it('deve abortar e sinalizar erro se falhar ao criar a pasta no disco', async () => {
        mockFileSystem.mkdir.mockRejectedValue(new Error('Permission Denied'));
        await InicializaTarefa_1.passoInicializaTarefa.func(mockContexto);
        expect(mockContexto.tarefaAtual.erroInicializacao).toBe(true);
        expect(mockedAxios.put).not.toHaveBeenCalled(); // Não atualiza status se não tem disco
    });
    it('deve continuar graciosamente se a API de status falhar', async () => {
        mockedAxios.get.mockRejectedValue(new Error('API Offline'));
        await expect(InicializaTarefa_1.passoInicializaTarefa.func(mockContexto)).resolves.not.toThrow();
        // Ele ainda deve ter criado a pasta e mantido a flag limpa para a tarefa continuar
        expect(mockFileSystem.mkdir).toHaveBeenCalled();
        expect(mockContexto.tarefaAtual.erroInicializacao).toBeUndefined();
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
