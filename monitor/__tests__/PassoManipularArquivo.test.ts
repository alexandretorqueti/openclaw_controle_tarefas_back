// monitor/__tests__/PassoManipularArquivo.test.ts

import { PassoManipularArquivo } from '../passos/atomicos/PassoManipularArquivo';
import type { ServicoDisco } from '../passos/atomicos/PassoManipularArquivo';
import { criarLoggerMock } from './fixtures/fabricaMocks';

describe('PassoManipularArquivo', () => {
  const criarMockDisco = (): jest.Mocked<ServicoDisco> => ({
    escrever: jest.fn().mockResolvedValue(undefined),
    ler: jest.fn().mockResolvedValue('conteudo do disco'),
    apagar: jest.fn().mockResolvedValue(undefined),
  });

  it('deve realizar escrita no disco de forma abstrata', async () => {
    const logger = criarLoggerMock();
    const disco = criarMockDisco();

    const passo = new PassoManipularArquivo({ logger, disco });
    const result = await passo.execute({
      acao: 'escrever',
      caminhoAbsoluto: '/tmp/test.txt',
      conteudo: 'hello',
    });

    expect(result.sucesso).toBe(true);
    expect(disco.escrever).toHaveBeenCalledWith('/tmp/test.txt', 'hello', true);
  });

  it('deve realizar leitura do disco', async () => {
    const logger = criarLoggerMock();
    const disco = criarMockDisco();

    const passo = new PassoManipularArquivo({ logger, disco });
    const result = await passo.execute({
      acao: 'ler',
      caminhoAbsoluto: '/tmp/test.txt',
    });

    expect(result.sucesso).toBe(true);
    expect(result.conteudoLido).toBe('conteudo do disco');
    expect(disco.ler).toHaveBeenCalledWith('/tmp/test.txt');
  });

  it('deve capturar falhas do sistema operacional (ex: arquivo inexistente)', async () => {
    const logger = criarLoggerMock();
    const disco = criarMockDisco();
    disco.ler.mockRejectedValueOnce(new Error('ENOENT no such file'));

    const passo = new PassoManipularArquivo({ logger, disco });
    const result = await passo.execute({
      acao: 'ler',
      caminhoAbsoluto: '/tmp/naoexiste.txt',
    });

    expect(result.sucesso).toBe(false);
    expect(result.conteudoLido).toBeUndefined();
    expect(result.mensagemErro).toContain('ENOENT');
    expect(logger.erro).toHaveBeenCalledWith(expect.stringContaining('ENOENT'));
  });
});
