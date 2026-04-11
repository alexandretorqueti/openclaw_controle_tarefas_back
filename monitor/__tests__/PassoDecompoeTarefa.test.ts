import { PassoDecompoeTarefa } from '../passos/atomicos/PassoDecompoeTarefa';
import { ContextoExecucao } from '../interfaces';

describe('PassoDecompoeTarefa', () => {
  let deps: any;
  let passo: PassoDecompoeTarefa;

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
    passo = new PassoDecompoeTarefa(deps as any);
  });

  it('deve chamar o motor de IA e retornar sub-tarefas no formato correto', async () => {
    const mockContexto = {
      tarefaAtual: {
        id: 1,
        title: 'Criar Autenticação',
        description: 'Implementar login e cadastro com JWT',
        project: { name: 'Projeto Teste', agent: 'senior-dev' }
      },
      project: { id: 10, agent: 'senior-dev', modeloAuxiliar: 'gpt-4' },
      config: { TASK_TIMEOUT_MS: 10000 },
      configIA: { agentId: 'senior-dev' }
    } as unknown as ContextoExecucao;

    const mockIAOutput = {
      precisaDividir: true,
      motivo: 'Tarefa complexa',
      subtarefas: [
        { title: 'Backend: JWT', description: 'Configurar strategy', domain: 'BACKEND' },
        { title: 'Frontend: Login', description: 'Criar form', domain: 'FRONTEND' }
      ],
      success: true
    };

    deps.motorUniversal.executeWithValidationLoop.mockResolvedValue(mockIAOutput);

    const resultado = await passo.execute(mockContexto);

    expect(resultado.precisaDividir).toBe(true);
    expect(resultado.subtarefas).toHaveLength(2);
    expect(deps.motorUniversal.executeWithValidationLoop).toHaveBeenCalled();
  });
});
