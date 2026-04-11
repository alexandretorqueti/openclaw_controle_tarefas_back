import { PassoVerificaAtomicidade } from '../passos/atomicos/PassoVerificaAtomicidade';
import { ContextoExecucao } from '../interfaces';

describe('PassoVerificaAtomicidade', () => {
  let deps: any;
  let passo: PassoVerificaAtomicidade;

  beforeEach(() => {
    deps = {
      logger: { 
        info: jest.fn().mockResolvedValue(undefined), 
        debug: jest.fn().mockResolvedValue(undefined), 
        erro: jest.fn().mockResolvedValue(undefined), 
        warn: jest.fn().mockResolvedValue(undefined) 
      },
      motorUniversal: { executeWithValidationLoop: jest.fn() }
    };
    passo = new PassoVerificaAtomicidade(deps as any);
  });

  it('deve validar se uma tarefa é atômica via motor de IA', async () => {
    const mockContexto = {
      tarefaAtual: { 
        id: 1, 
        title: 'Criar Botão de Login', 
        description: 'Desenvolver componente de botão simples',
        project: { name: 'Projeto UI' }
      },
      project: { agent: 'senior-dev', modeloAuxiliar: 'gpt4' },
      config: { TASK_TIMEOUT_MS: 15000 },
      configIA: { agentId: 'senior-dev' }
    } as unknown as ContextoExecucao;

    const mockIAOutput = {
      isIdeal: true,
      reason: 'Tarefa bem delimitada',
      confidence: 95,
      inferredDomain: 'FRONTEND',
      success: true
    };

    deps.motorUniversal.executeWithValidationLoop.mockResolvedValue(mockIAOutput);

    const resultado = await passo.execute(mockContexto);

    expect(resultado.isIdeal).toBe(true);
    expect(resultado.confidence).toBe(95);
    expect(deps.motorUniversal.executeWithValidationLoop).toHaveBeenCalled();
  });
});
