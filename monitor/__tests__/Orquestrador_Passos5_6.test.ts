import { OrquestradorTarefas } from '../Orquestrador';
import { passoPreAnaliseEscopoTarerefa } from '../passos/atomicos/PassoPreAnaliseEscopoTarefa';
import PassoVerificaAtomicidade from '../passos/atomicos/PassoVerificaAtomicidade';
import { PassoVerificaLock } from '../passos/atomicos/PassoVerificaLock';
import { PassoConfiguraUsuario } from '../passos/atomicos/PassoConfiguraUsuario';
import { PassoBuscaTarefa } from '../passos/atomicos/PassoBuscaTarefa';
import { PassoInicializaTarefa } from '../passos/atomicos/PassoInicializaTarefa';

jest.mock('../passos/atomicos/PassoPreAnaliseEscopoTarefa');
jest.mock('../passos/atomicos/PassoVerificaAtomicidade');
jest.mock('../passos/atomicos/PassoVerificaLock');
jest.mock('../passos/atomicos/PassoConfiguraUsuario');
jest.mock('../passos/atomicos/PassoBuscaTarefa');
jest.mock('../passos/atomicos/PassoInicializaTarefa');
jest.mock('../passos/macro/FaseFinaliza');

describe('Orquestrador - Passos 5 e 6', () => {
  let deps: any;
  let orquestrador: OrquestradorTarefas;

  beforeEach(() => {
    jest.clearAllMocks();

    deps = {
      logger: { debug: jest.fn(), info: jest.fn(), erro: jest.fn(), warn: jest.fn() },
      config: { 
        STATUS: { IN_PROGRESS: 'IN_PROGRESS', FAILED: 'FAILED', COMPLETED: 'COMPLETED' },
        TASK_TIMEOUT_MS: 1000,
        MY_USER_NICKNAME: 'test-user',
        API_URL: 'http://localhost',
        TASKS_DIR: '/tmp',
        BASE_DIR: '/tmp/base'
      },
      servicoLock: { releaseLock: jest.fn().mockResolvedValue(true) },
      servicoEstado: {},
      servicoUsuario: {},
      servicoBusca: {},
      servicoTarefas: { atualizarTarefa: jest.fn().mockResolvedValue(true) },
      criarContexto: () => ({
        controle: {},
        erros: {},
        outputPassos: {},
        resultados: { arquiteto: {}, programador: {} },
        config: { STATUS: { IN_PROGRESS: 'IN_PROGRESS' } },
        tarefaAtual: { id: 1, title: 'Test Task', isAtomic: false, project: {} }
      })
    };

    orquestrador = new OrquestradorTarefas(deps);

    (PassoVerificaLock.prototype.execute as jest.Mock).mockResolvedValue({ lockAtivo: false });
    (PassoConfiguraUsuario.prototype.execute as jest.Mock).mockResolvedValue({ userId: 'user-1' });
    (PassoBuscaTarefa.prototype.execute as jest.Mock).mockResolvedValue({ tarefa: { id: 1, project: {} } });
    (PassoInicializaTarefa.prototype.execute as jest.Mock).mockResolvedValue({ sucesso: true, taskDir: '/tmp/task-1' });
  });

  it('deve PULAR o Passo 6 quando o taskType for "development"', async () => {
    (passoPreAnaliseEscopoTarerefa.prototype.execute as jest.Mock).mockResolvedValue({
      success: true,
      taskType: 'development'
    });

    await orquestrador.executarCicloDaTarefa();

    expect(PassoVerificaAtomicidade.prototype.execute).not.toHaveBeenCalled();
    expect(deps.servicoTarefas.atualizarTarefa).not.toHaveBeenCalled();
  });

  it('deve EXECUTAR o Passo 6 e atualizar tarefa se for atômica e taskType NÃO for "development"', async () => {
    (passoPreAnaliseEscopoTarerefa.prototype.execute as jest.Mock).mockResolvedValue({
      success: true,
      taskType: 'feature' 
    });

    (PassoVerificaAtomicidade.prototype.execute as jest.Mock).mockResolvedValue({
      success: true,
      isIdeal: true,
      confidence: 90
    });

    await orquestrador.executarCicloDaTarefa();

    expect(PassoVerificaAtomicidade.prototype.execute).toHaveBeenCalled();
    expect(deps.servicoTarefas.atualizarTarefa).toHaveBeenCalled();
  });
});
