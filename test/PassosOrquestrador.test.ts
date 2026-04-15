import { OrquestradorTarefas } from '../monitor/Orquestrador';
import { PassoPreAnaliseEscopoTarefa } from '../monitor/passos/atomicos/PassoPreAnaliseEscopoTarefa';
import { PassoVerificaAtomicidade } from '../monitor/passos/atomicos/PassoVerificaAtomicidade';
import { PassoDecompoeTarefa } from '../monitor/passos/atomicos/PassoDecompoeTarefa';
import { PassoVerificaLock } from '../monitor/passos/atomicos/PassoVerificaLock';
import { PassoConfiguraUsuario } from '../monitor/passos/atomicos/PassoConfiguraUsuario';
import { PassoBuscaTarefa } from '../monitor/passos/atomicos/PassoBuscaTarefa';
import { PassoInicializaTarefa } from '../monitor/passos/atomicos/PassoInicializaTarefa';

jest.mock('../monitor/passos/atomicos/PassoPreAnaliseEscopoTarefa');
jest.mock('../monitor/passos/atomicos/PassoVerificaAtomicidade');
jest.mock('../monitor/passos/atomicos/PassoDecompoeTarefa');
jest.mock('../monitor/passos/atomicos/PassoVerificaLock');
jest.mock('../monitor/passos/atomicos/PassoConfiguraUsuario');
jest.mock('../monitor/passos/atomicos/PassoBuscaTarefa');
jest.mock('../monitor/passos/atomicos/PassoInicializaTarefa');
jest.mock('../monitor/passos/atomicos/PassoVerificaDominio');
jest.mock('../monitor/passos/atomicos/PassoArquiteto');

describe('Orquestrador - Integração Passos 5, 6 e 7', () => {
  let deps: any;
  let ctx: any;

  beforeEach(() => {
    ctx = {
      config: { STATUS: { IN_PROGRESS: 'IN_PROGRESS', COMPLETED: 'COMPLETED', FAILED: 'FAILED' } },
      controle: { taskDir: '/tmp' },
      erros: {},
      outputPassos: {},
      resultados: {},
      tarefaAtual: { id: '1', title: 'Tarefa Teste', isAtomic: false, projectId: 'p1', project: { agent: 'gpt-4' } },
      project: { agent: 'gpt-4' },
    };

    deps = {
      logger: { info: jest.fn(), debug: jest.fn(), erro: jest.fn(), warn: jest.fn() },
      servicoLock: { releaseLock: jest.fn().mockResolvedValue(true) },
      servicoEstado: {},
      servicoUsuario: {},
      servicoBusca: {},
      servicoTarefas: { atualizarTarefa: jest.fn().mockResolvedValue(true), createTask: jest.fn().mockResolvedValue(true) },
      criarContexto: jest.fn().mockReturnValue(ctx),
      config: { MY_USER_NICKNAME: 'alexandre', STATUS: { IN_PROGRESS: 'IN_PROGRESS' }, TASKS_DIR: '/tmp', API_URL: 'http://api' },
      pathUtil: { join: jest.fn() },
      fileSystem: {},
      clienteApi: {}
    };

    (PassoVerificaLock as jest.Mock).mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ lockAtivo: false }) }));
    (PassoConfiguraUsuario as jest.Mock).mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ userId: 'u1' }) }));
    (PassoBuscaTarefa as jest.Mock).mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ tarefa: ctx.tarefaAtual }) }));
    (PassoInicializaTarefa as jest.Mock).mockImplementation(() => ({ execute: jest.fn().mockResolvedValue({ sucesso: true, taskDir: '/tmp' }) }));
  });

  it('deve marcar tarefa como atômica no Passo 6 quando isIdeal for true', async () => {
    (PassoPreAnaliseEscopoTarefa as jest.Mock).mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, taskType: 'development' })
    }));

    (PassoVerificaAtomicidade as jest.Mock).mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, isIdeal: true })
    }));

    const orquestrador = new OrquestradorTarefas(deps);
    // Interromper o fluxo após os passos de interesse lançando erro no passo seguinte (Passo 8/9 ou snapshot)
    deps.servicoSnapshot = { takeSnapshot: jest.fn().mockRejectedValue(new Error('STOP_FLOW')) };

    await orquestrador.executarCicloDaTarefa();

    expect(deps.servicoTarefas.atualizarTarefa).toHaveBeenCalledWith(expect.objectContaining({ isAtomic: true }));
  });

  it('deve criar subtarefas no Passo 7 quando precisaDividir for true', async () => {
    (PassoPreAnaliseEscopoTarefa as jest.Mock).mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, taskType: 'development' })
    }));

    (PassoVerificaAtomicidade as jest.Mock).mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ success: true, isIdeal: false })
    }));

    (PassoDecompoeTarefa as jest.Mock).mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({
        success: true,
        precisaDividir: true,
        subtarefas: [{ title: 'Sub 1', description: 'D1' }]
      })
    }));

    const orquestrador = new OrquestradorTarefas(deps);
    await orquestrador.executarCicloDaTarefa();

    expect(deps.servicoTarefas.createTask).toHaveBeenCalledWith(expect.objectContaining({ title: 'Sub 1' }));
  });
});
