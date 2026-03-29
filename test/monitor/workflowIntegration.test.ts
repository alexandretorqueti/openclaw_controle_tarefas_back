// test/monitor/workflowIntegration.test.ts

import container from '../../src/container';
import { monitor } from '../../src/monitor';
import axios from 'axios';
import { createLegacyGetNextTask } from '../../src/steps/adapters/legacyGetNextTask';
import PromptFactory from '../../src/utils/promptFactory';
import { passoVerificaLock } from '../../src/steps/VerificaLock'; // <-- Importado para os testes de lock
import config from '../../src/aux/config';
import { AnalysisPlan } from '../../src/interfaces/interfaceMonitor';
import { ArchitectAnalysis } from '../../src/steps/ArchitectPlanning';
import { tr } from 'zod/v4/locales';

// 1. MOCKS DE MÓDULOS
jest.mock('../../src/container');
jest.mock('axios');
jest.mock('../../src/steps/adapters/legacyGetNextTask');

describe('Integração do Workflow: Ciclo Completo do Desenvolvedor', () => {
    
    // DECLARAÇÃO DOS MOCKS GLOBAIS
    let instanciaMonitor: monitor;
    let mockContexto: any; // <-- Adicionado para os testes de unidade de Lock
    const mockLog = jest.fn(); // Mock simples para o logger
    
    const mockSessionChainUtils = {
        generateIsolatedSessionId: jest.fn().mockResolvedValue('sessao-mock-123')
    };
    
    const mockSmartFileFinder = {
        findRealArchitectPlan: jest.fn().mockResolvedValue({ content: 'Plano mockado pelo Jest' })
    };
    
    const mockFileUtils = {
        fileExists: jest.fn().mockResolvedValue(true)
    };
    const mockLockService = {
        checkLock: jest.fn().mockResolvedValue({ locked: false }),
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(true),
        forceReleaseLock: jest.fn().mockResolvedValue(true)
    };

    const mockpromptFactory = PromptFactory; 

    const mockFileSystem = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        readdir: jest.fn().mockResolvedValue(['.done']), 
        unlink: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined)
    };
    
    const mockPath = { join: jest.fn((...args) => args.join('/')) };
    
    const mockStateService = { 
        registerActiveTask: jest.fn(),
        clearState: jest.fn().mockResolvedValue(true)
    };
    
    const mockTaskService = { 
        updateTask: jest.fn().mockResolvedValue(true),
        getNextTask: jest.fn(), 
        getTasks: jest.fn(),    
    };
    
    const mockValidationService = {
        validateWithAuxModel: jest.fn().mockResolvedValue({ isAtomic: true, domain: 'BACKEND' })
    };

    const mockOpenClaw = { executeWithFallback: jest.fn() };
    
    const mockAnalysis = {
        analyzeDeveloperTurn: jest.fn(),
        analyzeTaskScope: jest.fn(),
        analyzeArchitectResponse: jest.fn()
    };
    
    const mockWorkspaceSnapshotService = {
        takeSnapshot: jest.fn().mockResolvedValue({ files: {} }),
        compareSnapshots: jest.fn().mockReturnValue({ modified: ['file.ts'], created: [] })
    };
    
    const mockEvidenceService = {
        createEmptyEvidence: jest.fn().mockReturnValue({}),
        applyExecutionEvidence: jest.fn()
    };

    const mockedAxios = axios as jest.Mocked<typeof axios>;

    beforeAll(() => {
        // Silencia logs para o terminal ficar limpo
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
        
        // Setup Padrão de IA e Análise
        mockOpenClaw.executeWithFallback.mockResolvedValue({
            success: true,
            rawOutput: JSON.stringify({ action: "done", thought: "Tarefa concluída" }),
            toolCall: {},
            toolResult: {}
        });

        const spyAnalysis = jest.fn().mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: [],
            isTalkingWithoutAction: false
        });

        mockAnalysis.analyzeDeveloperTurn = spyAnalysis;

        const analysisTaskScopeSpy = jest.fn().mockResolvedValue
        (
            {
                taskType: 'development',
                requiresReport: false,
                expectedLayers: ['frontend', 'backend'],
                requiredModifiedLayers: ['frontend', 'backend'],
                mandatoryChecks: ['Verificar se a tarefa foi concluida corretamente'],
                definitionOfDone: ['Evidência de execução detectada'],
                finalizationInstructions: ['Escrever o resultado final no arquivo de relatorio'],
                risks: [
                    'Risco de loop infinito caso a IA não consiga corrigir o erro de sintaxe', 
                    'Risco de falha na análise de escopo levando a um plano de ação inadequado'
                ]
            }
        );
        mockAnalysis.analyzeTaskScope = analysisTaskScopeSpy;
        
        const analyzeArchitectResponseSpy = jest.fn().mockResolvedValue(
        {
            hasExecuted: false,
            hasPlan: true,
            confidence: 90,
            executionDetails: null,
            planDetails: 'Plano de ação detalhado para a tarefa, incluindo passos específicos e tecnologias a serem usadas.',
            analysisFailed : false,
            hadExecuted: false
        } as ArchitectAnalysis);

        mockAnalysis.analyzeArchitectResponse = analyzeArchitectResponseSpy;
        

        // Container Limpo e Unificado
        (container.resolve as jest.Mock).mockImplementation((name: string) => {
            const registry: Record<string, any> = {
                'lockService': mockLockService,
                'fileSystem': mockFileSystem,
                'taskFileService': mockFileSystem, // Adicionado para o Ceifador
                'path': mockPath,
                'validationService': mockValidationService,
                'monitorStateService': mockStateService,
                'stateService': mockStateService,
                'taskService': mockTaskService,
                'openClawService': mockOpenClaw,
                'workspaceSnapshotService': mockWorkspaceSnapshotService,
                'evidenceService': mockEvidenceService,
                'apiService': mockedAxios,
                'taskAnalysisService': mockAnalysis,
                'analysisService': mockAnalysis,
                'taskAnalysis': mockAnalysis,
                'analysis': mockAnalysis,
                'promptFactory': mockpromptFactory,
                'log': mockLog,
                'sessionChainUtils': mockSessionChainUtils,
                'smartFileFinder': mockSmartFileFinder,
                'fileUtils': mockFileUtils
            };
            return registry[name];
        });

        // Configura API mockada
        mockedAxios.get.mockImplementation((url: string) => {
            if (url.includes('/api/statuses')) {
                return Promise.resolve({
                    data: {
                        statuses: [
                            { id: 1, name: 'Pendente' },
                            { id: 2, name: 'Em Andamento' },
                            { id: 3, name: 'Concluído' }
                        ]
                    }
                });
            }
            if (url.includes('/api/users')) {
                return Promise.resolve({
                    data: { users: [{ id: 'user1', nickname: 'jarbas' }] }
                });
            }
            return Promise.resolve({ data: {} });
        });

        mockedAxios.put.mockResolvedValue({});

        // INJEÇÃO DA TAREFA ULTRA-COMPLETA
        (createLegacyGetNextTask as jest.Mock).mockReturnValue(jest.fn().mockResolvedValue({
            id: 'task-100',
            title: 'Botão com defeito',
            description: 'Corrigir CSS',
            domain: 'FRONTEND',
            isAtomic: true,
            project: { 
                id: 'proj-1',
                pastaBase: '/src',
                instructions: 'Use React'
            },
            initialSnapshot: { files: {} }, 
            loopsExecutados: 0,
            agenteAlocado: 'default-frontend-agent'
        }));

        // Cria o Mock Contexto para os testes unitários do VerificaLock
        mockContexto = {
            config: config, // Usa as configs mockadas importadas
            services: {
                lockService: mockLockService,
                stateService: mockStateService
            },
            controleExecucao: {},
            lockAtivo: false,
            files: {}
        };

        // 2. SÓ AGORA instanciamos o motor!
        instanciaMonitor = new monitor();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    // ==========================================
    // TESTES DE INTEGRAÇÃO (CICLO)
    // ==========================================

    it('deve executar o caminho feliz: Busca -> Validação -> Execução -> Sucesso', async () => {
        await instanciaMonitor.executaCiclo();
        
        await new Promise(resolve => setTimeout(resolve, 1000));

        expect(mockFileSystem.rename).toHaveBeenCalled(); 
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalled();

        expect(mockAnalysis.analyzeDeveloperTurn.mock.calls.length).toBe(0);
        expect(mockAnalysis.analyzeTaskScope.mock.calls.length).toBe(1);
        
    });

    it('deve detectar erro de sintaxe e realizar o LOOP de correção', async () => {
        mockOpenClaw.executeWithFallback
            .mockResolvedValueOnce({ rawOutput: '{"acao": "incompleta"' })
            .mockResolvedValueOnce({ rawOutput: '{"acao": "incompleta"' }) 
            .mockResolvedValueOnce({ rawOutput: '{"acao": "completa"}', success: true }); 

        mockAnalysis.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: [],
            isTalkingWithoutAction: false
        });

        await instanciaMonitor.executaCiclo();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalledTimes(3);
        
        const segundoPrompt = mockOpenClaw.executeWithFallback.mock.calls[2][1];
        expect(segundoPrompt).toContain('FEEDBACK DO SISTEMA');
        
        expect(mockFileSystem.rename).toHaveBeenCalled();
    });

    it('deve interromper a execução se exceder 5 loops de correção', async () => {
        mockOpenClaw.executeWithFallback.mockResolvedValue({ rawOutput: '{ erro' });
        
        await instanciaMonitor.executaCiclo();
        
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
    });

    it('deve encerrar silenciosamente se não houver tarefas na fila', async () => {
        mockTaskService.getNextTask.mockResolvedValue(null);
        (createLegacyGetNextTask as jest.Mock).mockReturnValue(
            jest.fn().mockResolvedValue(null)
        );
        mockedAxios.get.mockResolvedValue({ data: { tasks: [] } });

        await instanciaMonitor.executaCiclo();

        const chamadasMkdir = mockFileSystem.mkdir.mock.calls.map(call => call[0]);
        const tentouCriarPastaDaTarefa = chamadasMkdir.some(path => path.includes('task-100'));

        expect(tentouCriarPastaDaTarefa).toBe(false);
    });

    it('deve detectar lock ativo e interromper o ciclo para evitar conflitos', async () => {
        mockLockService.checkLock.mockResolvedValue({
            locked: true,
            ageRecent: true,
        });
        
        await instanciaMonitor.executaCiclo();
        
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
    });

    // ==========================================
    // TESTES DE UNIDADE DE PASSOS ISOLADOS
    // ==========================================

    it('deve limpar o lock órfão (PID morto) e permitir a continuação da execução', async () => {
        // 1. ARRANGE
        mockLockService.checkLock.mockResolvedValue({
            locked: false, 
            corrupted: false,
            pid: 9999,
            alive: false 
        });

        // 2. ACT
        await passoVerificaLock.func(mockContexto);

        // 3. ASSERT
        expect(mockLockService.forceReleaseLock).toHaveBeenCalled();
        expect(mockStateService.clearState).toHaveBeenCalled();

        expect(mockContexto.lockAtivo).toBe(false);
        expect(mockContexto.controleExecucao.processoFantasma).toBeUndefined();
    });

    it('deve identificar um processo fantasma (lock antigo) e acionar o Ceifador', async () => {
        // 1. ARRANGE
        mockLockService.checkLock.mockResolvedValue({
            locked: true,
            ageRecent: false, 
            pid: 1234,
            mtime: Date.now() - (config.TASK_TIMEOUT_MS + 1000) 
        });

        // 2. ACT
        await passoVerificaLock.func(mockContexto);

        // 3. ASSERT
        expect(mockContexto.lockAtivo).toBe(false);
        expect(mockContexto.controleExecucao.processoFantasma).toEqual({ pid: 1234 });
    });
    
});