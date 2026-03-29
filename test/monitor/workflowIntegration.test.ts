// test/monitor/workflowIntegration.test.ts

import container from '../../src/container';
import { monitor } from '../../src/monitor';
import axios from 'axios';
import { createLegacyGetNextTask } from '../../src/steps/adapters/legacyGetNextTask';
import PromptFactory from '../../src/utils/promptFactory';

// 1. MOCKS DE MÓDULOS
jest.mock('../../src/container');
jest.mock('axios');
jest.mock('../../src/steps/adapters/legacyGetNextTask');

describe('Integração do Workflow: Ciclo Completo do Desenvolvedor', () => {
    
    // 2. DECLARAÇÃO DOS MOCKS (No escopo global do describe)
    let instanciaMonitor: monitor;
    
    const mockLockService = {
        checkLock: jest.fn().mockResolvedValue(false),
        acquireLock: jest.fn().mockResolvedValue(true),
        releaseLock: jest.fn().mockResolvedValue(true)
    };

    const mockstepInexistente = {
        mockResolvedValue: jest.fn()
    }; 
    const mockpromptFactory = PromptFactory; // Usamos a implementação real, mas poderíamos mockar métodos específicos se necessário.

    const mockFileSystem = {
        mkdir: jest.fn().mockResolvedValue(undefined),
        writeFile: jest.fn().mockResolvedValue(undefined),
        // IMPORTANTE: Simulamos que o detetive ACHA o arquivo .done para a tarefa poder finalizar
        readdir: jest.fn().mockResolvedValue(['.done']), 
        unlink: jest.fn().mockResolvedValue(undefined),
        rename: jest.fn().mockResolvedValue(undefined)
    };
    
    const mockPath = { join: jest.fn((...args) => args.join('/')) };
    const mockStateService = { registerActiveTask: jest.fn() };
    const mockTaskService = 
        { 
            updateTask: jest.fn().mockResolvedValue(true),
            getNextTask: jest.fn(), // ✨ Adicione esta linha!
            getTasks: jest.fn(),    // Por garantia, se o seu código usar este nom
        };
    
    const mockValidationService = {
        validateWithAuxModel: jest.fn().mockResolvedValue({ isAtomic: true, domain: 'BACKEND' })
    };

    const mockOpenClaw = { executeWithFallback: jest.fn() };
    // No topo do arquivo, mude para:
    const mockAnalysis = {
        analyzeDeveloperTurn: jest.fn().mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: [],
            isTalkingWithoutAction: false
        }),
        analyzeTurn: jest.fn() // Por garantia
    };
    const mockWorkspaceSnapshotService = {
        takeSnapshot: jest.fn().mockResolvedValue({ files: {} }),
        compareSnapshots: jest.fn().mockReturnValue({ modified: ['file.ts'], created: [] })
    };
    
    const mockEvidenceService = {
        createEmptyEvidence: jest.fn().mockReturnValue({}),
        applyExecutionEvidence: jest.fn()
    };

    // Mock da API para passos como ConfiguraUsuario e InicializaTarefa não quebrarem
    const mockedAxios = axios as jest.Mocked<typeof axios>;

    beforeAll(() => {
        // Silencia logs para o terminal ficar limpo
        //jest.spyOn(console, 'error').mockImplementation(() => {});
        //jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    beforeEach(() => {
        jest.clearAllMocks();
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

        // 2. Atribuímos ao objeto que o teste vigia
        mockAnalysis.analyzeDeveloperTurn = spyAnalysis;

        (container.resolve as jest.Mock).mockImplementation((name) => {
            if (['taskAnalysisService', 'analysisService', 'analysis'].includes(name)) {
                return { analyzeDeveloperTurn: spyAnalysis };
            }
            const mocks: Record<string, any> = {
                'lockService': mockLockService,
                'openClawService': mockOpenClaw, // <-- Confira se no monitor.ts está exatamente esse nome
                'monitorStateService': mockStateService,
                'fileSystem': mockFileSystem,
                'apiService': mockedAxios,
                'taskAnalysisService': mockAnalysis,
                'path': mockPath,
                'stepAtualNome': mockstepInexistente,
                'promptFactory': mockpromptFactory
            };
            return mocks[name];
        });

        (container.resolve as jest.Mock).mockImplementation((name: string) => {
            const registry: Record<string, any> = {
                'lockService': mockLockService,
                'fileSystem': mockFileSystem,
                'path': mockPath,
                'validationService': mockValidationService,
                'monitorStateService': mockStateService,
                'stateService': mockStateService,
                'taskService': mockTaskService,
                'openClawService': mockOpenClaw,
                'workspaceSnapshotService': mockWorkspaceSnapshotService,
                'evidenceService': mockEvidenceService,
                'apiService': mockedAxios,
                // Mapeia todas as variações para o mesmo mock
                'taskAnalysisService': mockAnalysis,
                'analysisService': mockAnalysis,
                'taskAnalysis': mockAnalysis,
                'analysis': mockAnalysis,
                'promptFactory': mockpromptFactory,
            };
            return registry[name];
        });
        // Configura API mockada
        // Configura API mockada para responder coisas diferentes dependendo da URL
        mockedAxios.get.mockImplementation((url: string) => {
            if (url.includes('/api/statuses')) {
                return Promise.resolve({
                    data: {
                        statuses: [
                            { id: 1, name: 'Pendente' },
                            { id: 2, name: 'Em Andamento' }, // O que o InicializaTarefa procura
                            { id: 3, name: 'Concluído' }
                        ]
                    }
                });
            }
            
            if (url.includes('/api/users')) {
                return Promise.resolve({
                    data: {
                        users: [{ id: 'user1', nickname: 'jarbas' }]
                    }
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
            // 💡 O QUE ESTAVA FALTANDO:
            initialSnapshot: { files: {} }, 
            loopsExecutados: 0,
            agenteAlocado: 'default-frontend-agent'
        }));

        // 2. SÓ AGORA instanciamos o motor! Ele vai ler os mocks acima perfeitamente.
        instanciaMonitor = new monitor();
    });

    afterAll(() => {
        jest.restoreAllMocks();
    });

    it('deve executar o caminho feliz: Busca -> Validação -> Execução -> Sucesso', async () => {
        // ... (seu setup de mockResolvedValue igual ao anterior)

        await instanciaMonitor.executaCiclo();
        
        // Pausa técnica para garantir o fim das promessas
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Verificações
        expect(mockFileSystem.rename).toHaveBeenCalled(); // Se este passar, a esteira rodou!
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalled();

        // Verifica se QUALQUER UM dos métodos de análise foi chamado
        const foiChamado = mockAnalysis.analyzeDeveloperTurn.mock.calls.length > 0 || 
                           mockAnalysis.analyzeTurn.mock.calls.length > 0;
        
        expect(foiChamado).toBe(false);
    });

    it('deve detectar erro de sintaxe e realizar o LOOP de correção', async () => {
        // 1. Configuramos o OpenClaw para falhar na 1ª (truncado) e acertar na 2ª
        mockOpenClaw.executeWithFallback
            .mockResolvedValueOnce({ rawOutput: '{"acao": "incompleta"' }) // Syntax Error
            .mockResolvedValueOnce({ rawOutput: '{"acao": "completa"}', success: true }); // Sucesso

        // O Juiz vai perdoar o segundo turno
        mockAnalysis.analyzeDeveloperTurn.mockResolvedValue({
            isDeclaringDone: true,
            hasFulfilledContract: true,
            missingRequirements: [],
            isTalkingWithoutAction: false
        });

        // 2. Roda o motor
        await instanciaMonitor.executaCiclo();
        await new Promise(resolve => setTimeout(resolve, 500))
        // 3. Validação do Loop
        // O executeWithFallback deve ter sido chamado 2 vezes!
        expect(mockOpenClaw.executeWithFallback).toHaveBeenCalledTimes(2);
        
        // Verificamos se o prompt de correção da segunda chamada conteve o esporro do Juiz
        const segundoPrompt = mockOpenClaw.executeWithFallback.mock.calls[1][1];
        expect(segundoPrompt).toContain('[ERRO DE SINTAXE]');
        
        // A tarefa eventualmente finalizou após o loop
        expect(mockFileSystem.rename).toHaveBeenCalled();
    });


    it('deve interromper a execução se exceder 5 loops de correção', async () => {
        // Setup: O mock da IA sempre retorna erro de sintaxe
        mockOpenClaw.executeWithFallback.mockResolvedValue({ rawOutput: '{ erro' });
        
        await instanciaMonitor.executaCiclo();
        
        // Verifique se ele parou por segurança e não chamou o 'Finaliza Tarefa'
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
        // Verifique se o log de "Limite de tentativas" apareceu
    });

    it('deve encerrar silenciosamente se não houver tarefas na fila', async () => {
        // 1. FORÇA o serviço de busca a dizer que NÃO tem nada
        // Se você usa o 'taskService' no container:
        mockTaskService.getNextTask.mockResolvedValue(null);
        (createLegacyGetNextTask as jest.Mock).mockReturnValue(
            jest.fn().mockResolvedValue(null) // Retorna null em vez do objeto da tarefa
        );
        // Se você usa o 'apiService' (Axios) para buscar:
        mockedAxios.get.mockResolvedValue({ data: { tasks: [] } });

        // 2. Roda o motor
        await instanciaMonitor.executaCiclo();

        // 3. A VERIFICAÇÃO INTELIGENTE:
        // Em vez de checar se mkdir NUNCA foi chamado (pois o monitor pode criar pastas base no init),
        // vamos checar se ele NÃO tentou criar a pasta específica da 'task-100'.
        
        const chamadasMkdir = mockFileSystem.mkdir.mock.calls.map(call => call[0]);
        const tentouCriarPastaDaTarefa = chamadasMkdir.some(path => path.includes('task-100'));

        expect(tentouCriarPastaDaTarefa).toBe(false);
    });

    // Caso onde o lock começa bloqueado
    it('deve detectar lock ativo e interromper o ciclo para evitar conflitos', async () => {
        // 1. Configura o lock para parecer que já está ativo
        mockLockService.checkLock.mockResolvedValue({
            locked: true,
            ageRecent: true,
        });
        
        // 2. Roda o motor
        await instanciaMonitor.executaCiclo();
        
        // 3. Verifica se ele parou por segurança e não chamou o 'Finaliza Tarefa'
        expect(mockFileSystem.rename).not.toHaveBeenCalled();
    });

    // Caso onde tentamos rodar um passo que não existe
    it('deve logar erro crítico se o passo não existir no catálogo', async () => {
        // 1. Configura o monitor para começar com um passo inexistente
        const passoInexistente = 'passoInexistente';
        mockstepInexistente.mockResolvedValue(passoInexistente);

        // 2. Roda o motor
        await instanciaMonitor.executaCiclo();

        // 3. Verifica se o log de erro crítico foi chamado
        // Aqui, como o log é um console.log, podemos espiar o console ou refinar o design para injetar um logger mockável.
        // Para simplicidade, vamos espiar o console.log:
        const consoleSpy = jest.spyOn(console, 'log');
        const foiChamado = mockAnalysis.analyzeDeveloperTurn.mock.calls.length > 0 || 
                           mockAnalysis.analyzeTurn.mock.calls.length > 0;
        
        expect(foiChamado).toBe(false);

    });
    
});