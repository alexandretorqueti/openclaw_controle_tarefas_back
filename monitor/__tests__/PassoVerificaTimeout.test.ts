// monitor/__tests__/PassoVerificaTimeout.test.ts

import { PassoVerificaTimeout } from '../passos/atomicos/PassoVerificaTimeout';
import { criarLoggerMock } from './fixtures/fabricaMocks';

describe('PassoVerificaTimeout', () => {
  it('deve logar erro fatal de processo fantasma e encerrar', async () => {
    const logger = criarLoggerMock();
    const passo = new PassoVerificaTimeout({ logger });

    const result = await passo.execute({ processoFantasmaPid: 404 });

    expect(result.encerrado).toBe(true);
    expect(logger.erro).toHaveBeenCalledWith(
      expect.stringContaining('Processo fantasma detectado (PID: 404)')
    );
  });
});
