// monitor/__tests__/FaseFinaliza.test.ts

import { MacroFaseFinalizacao } from '../passos/macro/FaseFinaliza';
import type { ClienteApiFinalizacao } from '../passos/macro/FaseFinaliza';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('MacroFaseFinalizacao', () => {
  const criarClienteMock = (): jest.Mocked<ClienteApiFinalizacao> => ({
    buscarStatusPorNome: jest.fn().mockResolvedValue({ id: 5 }),
    atualizarStatusTarefa: jest.fn().mockResolvedValue(undefined),
    adicionarComentarioTarefa: jest.fn().mockResolvedValue(undefined),
  });

  it('deve atualizar status na API e adicionar comentário quando receber feedback do programador', async () => {
    const logger = criarLoggerMock();
    const clienteApi = criarClienteMock();

    const fase = new MacroFaseFinalizacao({ logger, clienteApi, apiUrl: 'http://api', userId: 'usr-1' });

    const input = {
      tarefaAtual: criarTarefaFake({ id: 10 }),
      novoStatus: 'Concluída',
      mensagemFechamento: 'Tarefa OK',
    };

    const resultado = await fase.execute(input);

    expect(resultado.sucesso).toBe(true);

    expect(clienteApi.buscarStatusPorNome).toHaveBeenCalledWith('http://api', 'Concluída');
    expect(clienteApi.atualizarStatusTarefa).toHaveBeenCalledWith('http://api', 10, 5);
    expect(clienteApi.adicionarComentarioTarefa).toHaveBeenCalledWith('http://api', 10, 'usr-1', 'Tarefa OK');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Tarefa movida para o status'));
  });

  it('deve logar erro e não estourar se status não existir na base', async () => {
    const logger = criarLoggerMock();
    const clienteApi = criarClienteMock();
    clienteApi.buscarStatusPorNome.mockResolvedValueOnce(null);

    const fase = new MacroFaseFinalizacao({ logger, clienteApi, apiUrl: 'http://api', userId: 'usr-1' });

    const input = {
      tarefaAtual: criarTarefaFake({ id: 10 }),
      novoStatus: 'Inexistente',
      mensagemFechamento: 'Tarefa OK',
    };

    const resultado = await fase.execute(input);

    expect(resultado.sucesso).toBe(true); // O passo não falha a esteira por erro da API
    expect(clienteApi.atualizarStatusTarefa).not.toHaveBeenCalled();
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('não existe no banco da API'));
  });

  it('não deve enviar comentário se não tiver userId', async () => {
    const logger = criarLoggerMock();
    const clienteApi = criarClienteMock();

    const fase = new MacroFaseFinalizacao({ logger, clienteApi, apiUrl: 'http://api', userId: null });

    const input = {
      tarefaAtual: criarTarefaFake({ id: 10 }),
      novoStatus: 'Concluída',
      mensagemFechamento: 'Tarefa OK',
    };

    await fase.execute(input);

    expect(clienteApi.adicionarComentarioTarefa).not.toHaveBeenCalled();
  });
});
