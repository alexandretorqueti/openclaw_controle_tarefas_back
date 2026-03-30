// monitor/__tests__/PassoBuscaTarefa.test.ts

import { PassoBuscaTarefa } from '../passos/atomicos/PassoBuscaTarefa';
import type { BuscadorTarefa } from '../passos/atomicos/PassoBuscaTarefa';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('PassoBuscaTarefa', () => {
  it('deve extrair a tarefa caso haja uma disponível na fila', async () => {
    const logger = criarLoggerMock();
    const mockBuscador: jest.Mocked<BuscadorTarefa> = {
      buscarProxima: jest.fn().mockResolvedValue(criarTarefaFake({ id: 10 })),
    };

    const passo = new PassoBuscaTarefa({ logger, buscadorTarefa: mockBuscador });
    const result = await passo.execute({ nickname: 'jarbas' });

    expect(mockBuscador.buscarProxima).toHaveBeenCalledWith('jarbas');
    expect(result.tarefa?.id).toBe(10);
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Tarefa capturada: [10]'));
  });

  it('deve retornar null silenciosamente se a fila estiver vazia', async () => {
    const logger = criarLoggerMock();
    const mockBuscador: jest.Mocked<BuscadorTarefa> = {
      buscarProxima: jest.fn().mockResolvedValue(null),
    };

    const passo = new PassoBuscaTarefa({ logger, buscadorTarefa: mockBuscador });
    const result = await passo.execute({ nickname: 'jarbas' });

    expect(result.tarefa).toBeNull();
  });

  it('deve logar erro e retornar null se houver falha de rede/api', async () => {
    const logger = criarLoggerMock();
    const mockBuscador: jest.Mocked<BuscadorTarefa> = {
      buscarProxima: jest.fn().mockRejectedValue(new Error('Network Error')),
    };

    const passo = new PassoBuscaTarefa({ logger, buscadorTarefa: mockBuscador });
    const result = await passo.execute({ nickname: 'jarbas' });

    expect(result.tarefa).toBeNull();
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('Network Error'));
  });
});
