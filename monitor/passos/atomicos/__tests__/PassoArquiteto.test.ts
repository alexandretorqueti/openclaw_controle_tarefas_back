
import { PassoArquiteto } from '../PassoArquiteto';

describe('PassoArquiteto - Novo Padrão Zod', () => {
  let passo: any;
  let mockDeps: any;

  beforeEach(() => {
    mockDeps = {
      logger: { info: jest.fn(), erro: jest.fn(), warn: jest.fn() },
      servicoOpenClaw: {
        enviarPrompt: jest.fn().mockResolvedValue(JSON.stringify({
          planDetails: '1. Criar novo componente\n2. Adicionar tipagem',
          architectNotes: 'Usar design system local',
          isFullyImplemented: false,
          success: true
        }))
      }
    };
    passo = new PassoArquiteto(mockDeps);
  });

  it('deve processar o retorno da IA e converter para o schema correto', async () => {
    const mockCtx = {
      tarefaAtual: { title: 'Teste', description: 'Desc', comments: [] },
      project: {},
      outputPassos: { preanalise: { taskType: 'development' } }
    };

    const resultado = await passo.execute(mockCtx);

    expect(resultado.success).toBe(true);
    expect(resultado.planDetails).toContain('1. Criar novo componente');
    expect(mockDeps.servicoOpenClaw.enviarPrompt).toHaveBeenCalled();
  });

  it('deve usar o fallback em caso de erro na IA', async () => {
    mockDeps.servicoOpenClaw.enviarPrompt.mockRejectedValue(new Error('IA Offline'));
    const mockCtx = { tarefaAtual: {}, project: {}, outputPassos: {} };

    const resultado = await passo.execute(mockCtx);

    expect(resultado.success).toBe(false);
    expect(resultado.error).toBe('IA Offline');
  });
});
