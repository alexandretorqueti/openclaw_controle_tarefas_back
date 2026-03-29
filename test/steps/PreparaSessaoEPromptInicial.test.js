"use strict";
// test/steps/PreparaSessaoEPromptInicial.test.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const PreparaSessaoEPromptInicial_1 = require("../../src/steps/PreparaSessaoEPromptInicial");
const container_1 = __importDefault(require("../../src/container"));
jest.mock('../../src/container');
beforeAll(() => {
    // Faz o console.error não fazer nada durante o teste 
    // (ou apenas imprimir a mensagem sem o rastro do Jest)
    jest.spyOn(console, 'error').mockImplementation(() => { });
});
describe('Passo: Prepara Sessão e Prompt para Programador', () => {
    let mockContexto;
    let mockFileSystem;
    let mockPath;
    beforeEach(() => {
        jest.clearAllMocks();
        mockFileSystem = {
            writeFile: jest.fn().mockResolvedValue(undefined)
        };
        mockPath = {
            join: jest.fn((dir, file) => `${dir}/${file}`)
        };
        container_1.default.resolve.mockImplementation((name) => {
            if (name === 'fileSystem')
                return mockFileSystem;
            if (name === 'path')
                return mockPath;
            return {};
        });
        // Simulando o tempo para testar a geração do SessionID
        jest.useFakeTimers().setSystemTime(new Date('2026-03-28T12:00:00Z'));
        mockContexto = {
            config: {
                TASKS_DIR: '/tmp/tasks'
            },
            tarefaAtual: {
                id: '123',
                title: 'Corrigir botão',
                description: 'O botão de login não clica.',
                taskDir: '/tmp/tasks/123',
                project: {
                    instructions: 'Use TailwindCSS.'
                }
            }
        };
    });
    afterEach(() => {
        jest.useRealTimers();
    });
    it('deve preparar o sessionId, o promptVez e salvar no disco (Caminho Feliz)', async () => {
        await PreparaSessaoEPromptInicial_1.passoPreparaSessaoEPromptInicial.func(mockContexto);
        // Verifica a sessão única gerada pelo timestamp fake
        const expectedTimestamp = new Date('2026-03-28T12:00:00Z').getTime();
        expect(mockContexto.tarefaAtual.sessionId).toBe(`session-123-${expectedTimestamp}`);
        expect(mockContexto.tarefaAtual.loopsExecutados).toBe(0);
        // Verifica a montagem do prompt
        expect(mockContexto.tarefaAtual.promptVez).toContain('=== TAREFA [123] ===');
        expect(mockContexto.tarefaAtual.promptVez).toContain('O botão de login não clica.');
        expect(mockContexto.tarefaAtual.promptVez).toContain('Use TailwindCSS.');
        expect(mockContexto.tarefaAtual.promptVez).toContain('.done'); // Instrução mestre presente
        // Verifica se tentou salvar no disco dentro da pasta da tarefa
        expect(mockPath.join).toHaveBeenCalledWith('/tmp/tasks/123', 'prompt-init.txt');
        expect(mockFileSystem.writeFile).toHaveBeenCalledWith('/tmp/tasks/123/prompt-init.txt', mockContexto.tarefaAtual.promptVez);
    });
    it('deve usar instrução de fallback se o projeto não tiver regras definidas', async () => {
        mockContexto.tarefaAtual.project = null;
        await PreparaSessaoEPromptInicial_1.passoPreparaSessaoEPromptInicial.func(mockContexto);
        expect(mockContexto.tarefaAtual.promptVez).toContain('Siga as boas práticas de desenvolvimento');
    });
    it('deve garantir que o promptVez seja injetado MESMO SE a escrita em disco falhar', async () => {
        // Simulando falha de permissão no disco
        mockFileSystem.writeFile.mockRejectedValue(new Error('EACCES: permission denied'));
        // O passo não deve quebrar
        await expect(PreparaSessaoEPromptInicial_1.passoPreparaSessaoEPromptInicial.func(mockContexto)).resolves.not.toThrow();
        // O prompt DEV existir na memória para a IA poder trabalhar
        expect(mockContexto.tarefaAtual.promptVez).toBeDefined();
        expect(mockContexto.tarefaAtual.promptVez).toContain('=== TAREFA [123] ===');
    });
});
afterAll(() => {
    jest.restoreAllMocks();
});
