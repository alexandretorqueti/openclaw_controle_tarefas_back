import { PassoVerificaDominio } from '../passos/atomicos/PassoVerificaDominio';
import { ContextoExecucao } from '../interfaces';

describe('PassoVerificaDominio', () => {
  let deps: any;
  let passo: PassoVerificaDominio;

  beforeEach(() => {
    deps = {
      logger: { 
        info: jest.fn().mockResolvedValue(undefined), 
        debug: jest.fn().mockResolvedValue(undefined), 
        erro: jest.fn().mockResolvedValue(undefined), 
        warn: jest.fn().mockResolvedValue(undefined) 
      },
      motorUniversal: { executeWithValidationLoop: jest.fn() },
      gerenciadorFalha: { registrarFalha: jest.fn().mockResolvedValue(undefined) }
    };
    passo = new PassoVerificaDominio(deps as any);
  });

  it('deve retornar o domínio existente se já estiver definido na tarefa', async () => {
    const mockContexto = {
      tarefaAtual: { domain: 'BACKEND' }
    } as unknown as ContextoExecucao;

    const resultado = await passo.execute(mockContexto);

    expect(resultado.dominioValido).toBe(true);
    expect(resultado.dominio).toBe('BACKEND');
    expect(deps.motorUniversal.executeWithValidationLoop).not.toHaveBeenCalled();
  });

  it('deve chamar a IA se a tarefa não tiver domínio e retornar o domínio inferido', async () => {
    const mockContexto = {
      tarefaAtual: { 
        id: 1, 
        title: 'Teste', 
        description: 'Desc',
        project: { name: 'Projeto Teste' }
      },
      project: { agent: 'dev', modeloAuxiliar: 'gpt4' },
      config: { TASK_TIMEOUT_MS: 10000, API_URL: '', TASKS_DIR: '', ERROR_DIR: '' },
      configIA: { agentId: 'dev' }
    } as unknown as ContextoExecucao;

    const mockIAOutput = {
      isIdeal: true,
      reason: 'OK',
      confidence: 90,
      inferredDomain: 'FRONTEND'
    };

    deps.motorUniversal.executeWithValidationLoop.mockResolvedValue(mockIAOutput);

    const resultado = await passo.execute(mockContexto);

    expect(resultado.dominioValido).toBe(true);
    expect(resultado.dominio).toBe('FRONTEND');
    expect(deps.motorUniversal.executeWithValidationLoop).toHaveBeenCalled();
  });
});
