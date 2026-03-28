import { monitor } from '../../src/monitor';
import container from '../../src/container';

// Mock do container para interceptar as dependências
jest.mock('../../src/container');

describe('Integração do Workflow: Ciclo Completo do Desenvolvedor', () => {
    let instanciaMonitor: monitor;
    
    // Mocks dos Serviços
    const mockLockService = {
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(true),
        checkLock: jest.fn().mockResolvedValue(false)
    };

    const mockOpenClaw = {
        executeWithFallback: jest.fn()
    };
    
    const mockAnalysis = {
        analyzeDeveloperTurn: jest.fn()
    };

    const mockTaskService = {
        updateTask: jest.fn().mockResolvedValue(true)
    };

    // Objeto para capturar o contexto real criado dentro do monitor
    let contextoCapturado: any = null;

    beforeEach(() => {
        jest.clearAllMocks();
        contextoCapturado = null;

        // Configuração do Container para injetar nossos mocks
        (container.resolve as jest.Mock).mockImplementation((name) => {
            switch (name) {
                case 'lockService': return mockLockService;
                case 'openClawService': return mockOpenClaw;
                case 'taskAnalysisService': return mockAnalysis;
                case 'taskService': return mockTaskService;
                case 'monitorStateService': return { 
                    registerActiveTask: jest.fn(),
                    // Truque: quando o estado for registrado, capturamos o contexto
                    setTaskStatus: jest.fn((task, status, ctx) => { contextoCapturado = ctx; }) 
                };
                case 'fileSystem': return { 
                    readdir: jest.fn().mockResolvedValue(['.done']),
                    writeFile: jest.fn().mockResolvedValue(true) 
                };
                case 'path': return require('path');
                case 'workspaceSnapshotService': return { 
                    takeSnapshot: jest.fn().mockResolvedValue({}),
                    compareSnapshots: jest.fn().mockReturnValue({ modified: [], created: [] })
                };
                case 'evidenceService': return { 
                    createEmptyEvidence: jest.fn().mockReturnValue({}),
                    applyExecutionEvidence: jest.fn()
                };
                default: return {};
            }
        });

        instanciaMonitor = new monitor();
    });

    it('deve executar o caminho feliz: Busca -> Validação -> Execução -> Sucesso', async () => {
        // 1. Preparar o cenário: Simulamos que os primeiros passos preencheram o contexto
        // Como não podemos injetar o contexto, forçamos o primeiro passo a preencher o que precisamos
        mockOpenClaw.executeWithFallback.mockResolvedValue({
            success: true,
            rawOutput: '{"action": "done"}',
            toolCall: {},
            toolResult: {}
        });
        
        mockAnalysis.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: []
        });

        // 2. EXECUTAR O MOTOR
        await instanciaMonitor.executaCiclo();

        // 3. VERIFICAÇÕES
        
        // Verificação de Lock (O monitor deve sempre liberar o lock no finally)
        expect(mockLockService.releaseLock).toHaveBeenCalled();
        
        // Verificação de Chamada à IA (OpenClaw)
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalled();
        
        // Verificação de Inspeção de Workspace (O .done foi achado pelo serviço de análise?)
        expect(mockAnalysis.analyzeDeveloperTurn).toHaveBeenCalledWith(
            expect.objectContaining({ doneExists: true })
        );
    });

    it('deve detectar erro de sintaxe e realizar o LOOP de correção', async () => {
        // Configuramos o OpenClaw para falhar na 1ª e acertar na 2ª
        mockOpenClaw.executeWithFallback
            .mockResolvedValueOnce({ rawOutput: '{"acao": "incompleta"' }) // Syntax Error (JSON aberto)
            .mockResolvedValueOnce({ rawOutput: '{"acao": "completa"}', success: true });

        // A análise do 1º turno (erro de sintaxe) nem deve ser chamada se o passo detectar truncamento
        mockAnalysis.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: []
        });

        await instanciaMonitor.executaCiclo();

        // VALIDAÇÃO DO LOOP:
        // O executeWithFallback deve ter sido chamado 2 vezes (Original + Correção)
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalledTimes(2);
        
        // O segundo prompt deve conter o aviso de erro de sintaxe
        const segundoPrompt = mockOpenClaw.executeWithFallback.mock.calls[1][1];
        expect(segundoPrompt).toContain('[ERRO DE SINTAXE]');
    });
});