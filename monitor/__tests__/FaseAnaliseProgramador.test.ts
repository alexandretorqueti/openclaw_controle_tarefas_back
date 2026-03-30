// monitor/__tests__/FaseAnaliseProgramador.test.ts

import { MacroFaseAnaliseProgramador } from '../passos/macro/FaseAnaliseProgramador';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('MacroFaseAnaliseProgramador', () => {
  it('deve validar workspace quando .done existe', async () => {
    const logger = criarLoggerMock();
    const arquivos = {
      existe: jest.fn().mockResolvedValue(true),
    };

    const fase = new MacroFaseAnaliseProgramador({ logger, arquivos });
    const input = {
      tarefaAtual: criarTarefaFake(),
      caminhoTaskDir: '/tmp/proj',
    };

    const resultado = await fase.execute(input);

    expect(arquivos.existe).toHaveBeenCalledWith('/tmp/proj/.done');
    expect(resultado.workspaceValidado).toBe(true);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Arquivo .done encontrado!'));
  });

  it('deve rejeitar workspace se .done nao for encontrado', async () => {
    const logger = criarLoggerMock();
    const arquivos = {
      existe: jest.fn().mockResolvedValue(false),
    };

    const fase = new MacroFaseAnaliseProgramador({ logger, arquivos });
    const input = {
      tarefaAtual: criarTarefaFake(),
      caminhoTaskDir: '/tmp/proj',
    };

    const resultado = await fase.execute(input);

    expect(arquivos.existe).toHaveBeenCalledWith('/tmp/proj/.done');
    expect(resultado.workspaceValidado).toBe(false);
    expect(resultado.mensagem).toContain('não encontrei artefatos');
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('IA mentiu'));
  });
});
