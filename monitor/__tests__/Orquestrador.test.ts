import { OrquestradorTarefas, DependenciasGlobais } from '../Orquestrador';
import { ContextoExecucao } from '../interfaces';

jest.mock('../passos/atomicos/PassoVerificaLock', () => ({ PassoVerificaLock: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ lockAtivo: false }) })) }));
jest.mock('../passos/atomicos/PassoConfiguraUsuario', () => ({ PassoConfiguraUsuario: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ userId: '123' }) })) }));
jest.mock('../passos/atomicos/PassoBuscaTarefa', () => ({ PassoBuscaTarefa: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ tarefa: { id: 1, title: 'Test', isAtomic: true, domain: 'BACKEND', project: { agent: 'agent1' } } }) })) }));
jest.mock('../passos/atomicos/PassoInicializaTarefa', () => ({ PassoInicializaTarefa: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true, taskDir: '/tmp/task' }) })) }));

jest.mock('../passos/atomicos/PassoPreAnaliseEscopoTarefa', () => {
  const mockClass = jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ success: true, taskType: 'development' }) }));
  return { __esModule: true, default: mockClass };
});

jest.mock('../passos/atomicos/PassoVerificaAtomicidade', () => {
  const mockClass = jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ success: true, isIdeal: true }) }));
  return { __esModule: true, default: mockClass };
});

jest.mock('../passos/atomicos/PassoDecompoeTarefa', () => ({ PassoDecompoeTarefa: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ success: true, precisaDividir: false, subtarefas: [] }) })) }));
jest.mock('../passos/atomicos/PassoVerificaDominio', () => ({ PassoVerificaDominio: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ dominioValido: true, dominio: 'BACKEND' }) })) }));
jest.mock('../passos/atomicos/PassoArquiteto', () => ({ PassoArquiteto: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ success: true, planDetails: 'Plan', isFullyImplemented: false }) })) }));

jest.mock('../passos/atomicos/PassoProgramador', () => {
  const mockClass = jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true, mensagem: 'Done' }) }));
  return { __esModule: true, default: mockClass };
});

jest.mock('../passos/macro/FaseInspecaoWorkspace', () => ({ MacroFaseInspecaoWorkspace: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true, hasDoneFile: true, hasRealChanges: true, fileChanges: { total: 1 } }) })) }));

jest.mock('../passos/atomicos/PassoAnaliseProgramador', () => {
  const mockClass = jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ workspaceValidado: true }) }));
  return { __esModule: true, default: mockClass };
});

jest.mock('../passos/atomicos/PassoExecutarComando', () => ({ PassoExecutarComando: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true }) })) }));
jest.mock('../passos/macro/FaseFinaliza', () => ({ MacroFaseFinalizacao: jest.fn().mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true }) })) }));
jest.mock('../services/DoneFileService', () => ({ DoneFileService: jest.fn() }));
jest.mock('../services/EvidenceService', () => ({ EvidenceService: jest.fn() }));
jest.mock('../services/WorkspaceSnapshotService', () => ({ WorkspaceSnapshotService: jest.fn().mockImplementation(() => ({ takeSnapshot: jest.fn().mockResolvedValue(new Map()) })) }));

describe('OrquestradorTarefas', () => {
  let deps: Partial<DependenciasGlobais>;
  let ctx: Partial<ContextoExecucao>;

  beforeEach(() => {
    ctx = {
      config: { STATUS: { IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', FAILED: 'FAILED' }, TASK_TIMEOUT_MS: 1000, MY_USER_NICKNAME: 'user', BASE_DIR: '/tmp' } as any,
      controle: { loopsExecutados: 0 } as any,
      erros: {},
      resultados: { dominio: { dominioValido: true }, superValidacao: { valido: true } } as any,
      outputPassos: { preanalise: null } as any
    };
    deps = {
      logger: { 
        info: jest.fn(), 
        erro: jest.fn().mockImplementation(msg => console.error("LOGGER ERRO:", msg)), 
        debug: jest.fn(), 
        warn: jest.fn() 
      } as any,
      criarContexto: jest.fn().mockReturnValue(ctx),
      servicoLock: { releaseLock: jest.fn().mockResolvedValue(true) } as any,
      servicoTarefas: { atualizarTarefa: jest.fn().mockResolvedValue(true), updateTask: jest.fn().mockResolvedValue(true), createTask: jest.fn().mockResolvedValue(true) } as any,
      config: ctx.config as any
    };
  });

  it('deve executar o ciclo completo sem loop no programador', async () => {
    const orquestrador = new OrquestradorTarefas(deps as DependenciasGlobais);
    await orquestrador.executarCicloDaTarefa();
    expect(deps.logger?.erro).not.toHaveBeenCalled();
    expect(deps.logger?.info).toHaveBeenCalledWith(expect.stringContaining('Ciclo da Tarefa [1] encerrado'));
  });
});
