// monitor/__tests__/PassoVerificaDominio.test.ts

import { PassoVerificaDominio } from '../passos/atomicos/PassoVerificaDominio';
import type { GerenciadorFalhaTarefa } from '../passos/atomicos/PassoVerificaDominio';
import { criarLoggerMock, criarTarefaFake } from './fixtures/fabricaMocks';

describe('PassoVerificaDominio', () => {
  it('deve aprovar tarefa que possui domínio explícito', async () => {
    const logger = criarLoggerMock();
    const gerenciadorFalha: jest.Mocked<GerenciadorFalhaTarefa> = {
      registrarFalha: jest.fn().mockResolvedValue(undefined),
    };

    const passo = new PassoVerificaDominio({ logger, gerenciadorFalha });
    const input = {
      tarefa: criarTarefaFake({ domain: 'FRONTEND' }),
      userId: 'user-1',
      configFalha: { apiUrl: '', tasksDir: '', errorDir: '' },
    };

    const resultado = await passo.execute(input);

    expect(resultado.dominioValido).toBe(true);
    expect(gerenciadorFalha.registrarFalha).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('aprovada: FRONTEND'));
  });

  it('deve recusar tarefa atômica sem domínio e iniciar rotina de falha', async () => {
    const logger = criarLoggerMock();
    const gerenciadorFalha: jest.Mocked<GerenciadorFalhaTarefa> = {
      registrarFalha: jest.fn().mockResolvedValue(undefined),
    };

    const passo = new PassoVerificaDominio({ logger, gerenciadorFalha });
    const input = {
      tarefa: criarTarefaFake({ domain: null as any }),
      userId: 'user-1',
      configFalha: { apiUrl: 'http://a', tasksDir: '/t', errorDir: '/e' },
    };

    const resultado = await passo.execute(input);

    expect(resultado.dominioValido).toBe(false);
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('sem domínio definido'));
    
    // Assegurar que o sistema invocou o serviço de falha com as configs para ele gerenciar
    expect(gerenciadorFalha.registrarFalha).toHaveBeenCalledWith(
      input.tarefa,
      expect.any(Error),
      'user-1',
      input.configFalha
    );
  });
});
