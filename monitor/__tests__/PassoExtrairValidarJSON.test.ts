// monitor/__tests__/PassoExtrairValidarJSON.test.ts

import { PassoExtrairValidarJSON } from '../passos/atomicos/PassoExtrairValidarJSON';
import { criarLoggerMock } from './fixtures/fabricaMocks';

describe('PassoExtrairValidarJSON', () => {
  it('deve extrair JSON corretamente usando validador sem marcação markdown', async () => {
    const logger = criarLoggerMock();
    const mockValidador = {
      parsear: jest.fn().mockReturnValue({ test: true }),
    };

    const passo = new PassoExtrairValidarJSON({ logger, validador: mockValidador });

    const input = { textoBruto: '{"test": true}' };
    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.dados).toEqual({ test: true });
    expect(mockValidador.parsear).toHaveBeenCalledWith('{"test": true}');
  });

  it('deve extrair e ignorar o bloco markdown se existir ao redor do JSON', async () => {
    const logger = criarLoggerMock();
    const mockValidador = {
      parsear: jest.fn().mockReturnValue({ acao: 'feito' }),
    };

    const passo = new PassoExtrairValidarJSON({ logger, validador: mockValidador });

    const input = {
      textoBruto: `
      Claro, aqui está o JSON de resposta:
      \`\`\`json
      {
        "acao": "feito"
      }
      \`\`\`
      Terminei meu trabalho.`,
    };

    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(true);
    expect(resultado.dados).toEqual({ acao: 'feito' });
    
    // Confirma que ele mandou apenas o meio do match pro Zod/JSON.parse()
    expect(mockValidador.parsear).toHaveBeenCalledWith(
      expect.stringContaining('"acao": "feito"')
    );
  });

  it('deve falhar de forma gracefully se a extração ou schema validar der erro', async () => {
    const logger = criarLoggerMock();
    const mockValidador = {
      parsear: jest.fn().mockImplementation(() => {
        throw new Error('Schema falhou, falta "acao"');
      }),
    };

    const passo = new PassoExtrairValidarJSON({ logger, validador: mockValidador });

    const input = { textoBruto: '{ "invalido": true }' };
    const resultado = await passo.execute(input);

    expect(resultado.sucesso).toBe(false);
    expect(resultado.dados).toBeNull();
    expect(resultado.erroDeSintaxe).toContain('Schema falhou');
    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Erro ao tentar processar o JSON'));
  });
});
