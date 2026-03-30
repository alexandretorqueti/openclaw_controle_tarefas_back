// monitor/__tests__/PassoChamarIA.test.ts

import { PassoChamarIA } from '../passos/atomicos/PassoChamarIA';
import { criarLoggerMock, criarServicoOpenClawMock } from './fixtures/fabricaMocks';

describe('PassoChamarIA', () => {
  it('deve invocar o agente e devolver resposta raw da IA com sucesso', async () => {
    const logger = criarLoggerMock();
    const openClaw = criarServicoOpenClawMock();

    const passo = new PassoChamarIA({ logger, openClaw });

    const input = {
      prompt: 'Olá, Jarbas',
      agente: 'arquiteto-senior',
    };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.respostaRaw).toBe('{"acao":"ok"}');
    expect(openClaw.executarTurno).toHaveBeenCalledWith(input);
  });

  it('deve retornar fracasso quando OpenClaw der timeout ou erro interno (sucesso: false)', async () => {
    const logger = criarLoggerMock();
    const openClaw = criarServicoOpenClawMock();
    openClaw.executarTurno.mockResolvedValueOnce({ sucesso: false, output: '' });

    const passo = new PassoChamarIA({ logger, openClaw });

    const input = { prompt: 'Crash!', agente: 'arquiteto-senior' };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toContain('falhou em completar a resposta');
  });

  it('deve capturar exceções na biblioteca OpenClaw sem derrubar a pipeline', async () => {
    const logger = criarLoggerMock();
    const openClaw = criarServicoOpenClawMock();
    openClaw.executarTurno.mockRejectedValueOnce(new Error('Connection Refused'));

    const passo = new PassoChamarIA({ logger, openClaw });

    const input = { prompt: 'Conecta!', agente: 'arquiteto-senior' };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(false);
    expect(resultado.erro).toContain('Connection Refused');
  });
});
