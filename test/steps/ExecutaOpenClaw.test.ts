// test/steps/ExecutaOpenClaw.test.ts

import { passoExecutaOpenClaw } from '../../src/steps/ExecutaOpenClaw';
import container from '../../src/container';

jest.mock('../../src/container');
beforeAll(() => {
  // Faz o console.error não fazer nada durante o teste 
  // (ou apenas imprimir a mensagem sem o rastro do Jest)
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
describe('Passo: Executa OpenClaw', () => {
    let mockContexto: any;
    let mockOpenClawService: any;

    beforeEach(() => {
        jest.clearAllMocks();
        
        mockOpenClawService = {
            executeWithFallback: jest.fn()
        };
        (container.resolve as jest.Mock).mockReturnValue(mockOpenClawService);

        mockContexto = {
            config: {
                TASKS_DIR: '/tmp/tasks',
                TASK_TIMEOUT_MS: 30000
            },
            tarefaAtual: {
                id: 'task-123',
                project: { pastaBase: '/src' }
            }, 
            controleExecucao: {
                promptVez: 'Crie um botão em React.',
                sessionId: 'session-xyz',
                agenteAlocado: 'react-expert',
                loopsExecutados: 1, // Já rodou uma vez
                terminalLogFile: '/tmp/log.txt',
            },
        };
    });

    it('deve chamar o serviço OpenClaw e armazenar os resultados (Caminho Feliz)', async () => {
        const mockResponse = {
            rawOutput: '{"tool": "write_file"}',
            toolCall: { name: 'write_file' },
            toolResult: { success: true },
            toolFeedback: 'OK'
        };
        mockOpenClawService.executeWithFallback.mockResolvedValue(mockResponse);

        await passoExecutaOpenClaw.func(mockContexto);

        // O contador de loops deve ter subido de 1 para 2
        expect(mockContexto.controleExecucao.loopsExecutados).toBe(2);

        // Verifica se chamou a IA com os parâmetros certos
        expect(mockOpenClawService.executeWithFallback).toHaveBeenCalledWith(
            'session-xyz',
            'Crie um botão em React.',
            'react-expert', // Usou o agente alocado!
            'backup-agent',
            null,
            '/tmp/tasks',
            '/tmp/log.txt',
            '/src',
            30000
        );

        // Verifica as anotações na prancheta
        expect(mockContexto.controleExecucao.rawOutput).toBe('{"tool": "write_file"}');
        expect(mockContexto.controleExecucao.erroFatalIA).toBe(false);
    });

    it('deve usar o agente "main" se nenhum agente foi alocado previamente', async () => {
        mockContexto.controleExecucao.agenteAlocado = undefined;
        mockOpenClawService.executeWithFallback.mockResolvedValue({});

        await passoExecutaOpenClaw.func(mockContexto);

        // O terceiro argumento é o nome do agente
        expect(mockOpenClawService.executeWithFallback.mock.calls[0][2]).toBe('main');
    });

    it('deve sinalizar erroFatalIA se o serviço OpenClaw lançar uma exceção (Timeout/API Down)', async () => {
        mockOpenClawService.executeWithFallback.mockRejectedValue(new Error('API Rate Limit Exceeded'));

        await passoExecutaOpenClaw.func(mockContexto);

        expect(mockContexto.controleExecucao.erroFatalIA).toBe(true);
        expect(mockContexto.controleExecucao.ultimoErro).toBe('API Rate Limit Exceeded');
    });

    it('deve sinalizar erroFatalIA e abortar se o promptVez estiver vazio', async () => {
        mockContexto.controleExecucao.promptVez = null;

        await passoExecutaOpenClaw.func(mockContexto);

        // Não deve chamar a IA
        expect(mockOpenClawService.executeWithFallback).not.toHaveBeenCalled();
        // Deve sinalizar erro para a esteira ejetar a tarefa
        expect(mockContexto.controleExecucao.erroFatalIA).toBe(true);
    });
});
afterAll(() => {
  jest.restoreAllMocks();
});