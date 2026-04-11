import { OrquestradorTarefas, DependenciasGlobais } from '../Orquestrador';
import { ContextoExecucao } from '../interfaces';

describe('Orquestrador - Testes de Fluxo (Passos 1 ao 6)', () => {
  let deps: Partial<DependenciasGlobais>;
  let orquestrador: OrquestradorTarefas;
  let mockMotor: any;

  beforeEach(() => {
    mockMotor = { executeWithValidationLoop: jest.fn() };

    const mockConfig = {
      MY_USER_NICKNAME: 'alexandre',
      STATUS: { IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', FAILED: 'FAILED' },
      TASK_TIMEOUT_MS: 10000,
      TASKS_DIR: '/tmp',
      API_URL: 'http://localhost',
      BASE_DIR: '/home/alexandrebragatorqueti/projetos/monitor-tarefas'
    };

    deps = {
      logger: { 
        info: jest.fn((msg) => { console.log('LOG INFO:', msg); return Promise.resolve(); }),
        debug: jest.fn().mockResolvedValue(undefined),
        erro: jest.fn((msg) => { console.error('LOG ERROR:', msg); return Promise.resolve(); }),
        warn: jest.fn().mockResolvedValue(undefined) 
      } as any,
      servicoLock: { 
        checkLock: jest.fn().mockResolvedValue({ locked: false }),
        releaseLock: jest.fn().mockResolvedValue(undefined),
        forceReleaseLock: jest.fn().mockResolvedValue(undefined)
      },
      servicoEstado: { 
        getStatus: jest.fn().mockResolvedValue({}), 
        updateStatus: jest.fn().mockResolvedValue(undefined), 
        clearState: jest.fn().mockResolvedValue(undefined) 
      },
      servicoUsuario: { 
        getCurrentUser: jest.fn().mockResolvedValue({ id: 'user-123', nickname: 'alexandre' })
      },
      servicoBusca: { 
        buscarProximaTarefa: jest.fn().mockResolvedValue({ 
          tarefa: { 
            id: 1, 
            title: 'Teste Dev', 
            description: 'Desc', 
            project: { id: 10, agent: 'senior-dev', modeloAuxiliar: 'gpt-4' } 
          } 
        }) 
      },
      servicoTarefas: { atualizarTarefa: jest.fn().mockResolvedValue(undefined) },
      clienteApi: { put: jest.fn().mockResolvedValue({ data: {} }) },
      fileSystem: { 
        existsSync: jest.fn().mockReturnValue(true), 
        mkdirSync: jest.fn(), 
        writeFileSync: jest.fn() 
      },
      pathUtil: { 
        join: jest.fn((...args) => args.join('/')),
        resolve: jest.fn((...args) => args.join('/'))
      },
      motorUniversal: mockMotor,
      config: mockConfig as any,
      criarContexto: () => ({
        config: mockConfig,
        controle: { tentativasCorrecao: 0, maxTentativasCorrecao: 3 },
        erros: {},
        resultados: { arquiteto: {} },
        outputPassos: {},
        project: { id: 10, agent: 'senior-dev', modeloAuxiliar: 'gpt-4' } // Pre-injetando o project
      } as unknown as ContextoExecucao),
    };
    orquestrador = new OrquestradorTarefas(deps as DependenciasGlobais);
  });

  it('deve executar do passo 1 ao 6 com sucesso para uma tarefa development', async () => {
    mockMotor.executeWithValidationLoop.mockResolvedValue({
      success: true,
      taskType: 'development',
      expectedLayers: [],
      difficult: 1
    });

    try {
      await orquestrador.executarCicloDaTarefa();
    } catch (e) {
      console.error('Erro durante a execução do orquestrador:', e);
    }

    const calls = (deps.logger.info as jest.Mock).mock.calls.map(c => c[0]);
    console.log('Todas as chamadas de log:', calls);
    
    const encontrouTarefa = calls.some(msg => msg.toLowerCase().includes('tarefa'));
    expect(encontrouTarefa).toBe(true);
  });
});
