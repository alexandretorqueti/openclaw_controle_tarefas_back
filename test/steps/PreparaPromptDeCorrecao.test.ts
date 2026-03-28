// test/steps/PreparaPromptDeCorrecao.test.ts

import { passoPreparaPromptDeCorrecao } from '../../src/steps/PreparaPromptDeCorrecao';
import container from '../../src/container';

jest.mock('../../src/container');

describe('Passo: Prepara Prompt de Correção', () => {
    let mockContexto: any;
    let mockFileSystem: any;
    let mockPath: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockFileSystem = {
            writeFile: jest.fn().mockResolvedValue(undefined)
        };

        mockPath = {
            join: jest.fn((dir, file) => `${dir}/${file}`)
        };

        (container.resolve as jest.Mock).mockImplementation((name) => {
            if (name === 'fileSystem') return mockFileSystem;
            if (name === 'path') return mockPath;
            return {};
        });

        mockContexto = {
            config: {
                TASKS_DIR: '/tmp/tasks'
            },
            tarefaAtual: {
                id: '123',
                taskDir: '/tmp/tasks/123',
                loopsExecutados: 1,
                feedbackForNextTurn: '[ERRO DE SINTAXE] JSON quebrado.'
            }
        };
    });

    it('deve gerar o prompt com o feedback e salvar o log no disco (Caminho Feliz)', async () => {
        await passoPreparaPromptDeCorrecao.func(mockContexto);

        // Verifica se o promptVez foi atualizado corretamente com o template
        expect(mockContexto.tarefaAtual.promptVez).toContain('=== FEEDBACK DO SISTEMA ===');
        expect(mockContexto.tarefaAtual.promptVez).toContain('[ERRO DE SINTAXE] JSON quebrado.');

        // Verifica se salvou o log dentro da pasta da tarefa
        expect(mockPath.join).toHaveBeenCalledWith('/tmp/tasks/123', 'prompt-retry-loop-1.txt');
        expect(mockFileSystem.writeFile).toHaveBeenCalledWith(
            '/tmp/tasks/123/prompt-retry-loop-1.txt',
            mockContexto.tarefaAtual.promptVez
        );
    });

    it('deve retornar graciosamente sem fazer nada se não houver feedbackForNextTurn', async () => {
        mockContexto.tarefaAtual.feedbackForNextTurn = null;

        await passoPreparaPromptDeCorrecao.func(mockContexto);

        // Não deve tentar atualizar promptVez ou salvar arquivos
        expect(mockContexto.tarefaAtual.promptVez).toBeUndefined();
        expect(mockFileSystem.writeFile).not.toHaveBeenCalled();
    });

    it('deve lidar com erro ao salvar o arquivo de log sem quebrar a execução', async () => {
        mockFileSystem.writeFile.mockRejectedValue(new Error('Sem permissão de escrita'));

        // O catch dentro do passo deve engolir o erro e não dar throw para cima
        await expect(passoPreparaPromptDeCorrecao.func(mockContexto)).resolves.not.toThrow();

        // A IA ainda deve receber o prompt mesmo que o log do disco falhe
        expect(mockContexto.tarefaAtual.promptVez).toBeDefined();
    });
});