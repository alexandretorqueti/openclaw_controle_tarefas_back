// monitor/__tests__/PassoVerificaLock.test.ts

import { PassoVerificaLock } from '../passos/atomicos/PassoVerificaLock';
import {
  criarLoggerMock,
  criarLockServiceMock,
  criarStateServiceMock,
  criarContextoMock,
} from './fixtures/fabricaMocks';

describe('PassoVerificaLock', () => {
  const criarPasso = () => {
    const logger = criarLoggerMock();
    const lockService = criarLockServiceMock();
    const stateService = criarStateServiceMock();

    const passo = new PassoVerificaLock({
      logger,
      lockService,
      stateService,
    });

    return { passo, logger, lockService, stateService };
  };

  it('deve setar lockAtivo=true quando lock está recente', async () => {
    const { passo, lockService } = criarPasso();

    lockService.checkLock.mockResolvedValueOnce({
      locked: true,
      ageRecent: true,
      mtime: Date.now() - 5000,
    });

    const result = await passo.execute({ timeoutMs: 1000 });

    expect(result.lockAtivo).toBe(true);
    expect(result.processoFantasmaPid).toBeUndefined();
  });

  it('deve detectar processo fantasma quando lock é antigo', async () => {
    const { passo, lockService } = criarPasso();

    lockService.checkLock.mockResolvedValueOnce({
      locked: true,
      ageRecent: false,
      pid: 12345,
    });

    const result = await passo.execute({ timeoutMs: 1000 });

    expect(result.lockAtivo).toBe(false);
    expect(result.processoFantasmaPid).toBe(12345);
  });

  it('deve limpar lock corrompido', async () => {
    const { passo, lockService } = criarPasso();

    lockService.checkLock.mockResolvedValueOnce({
      locked: false,
      corrupted: true,
    });

    const result = await passo.execute({ timeoutMs: 1000 });

    expect(lockService.forceReleaseLock).toHaveBeenCalledTimes(1);
    expect(result.lockAtivo).toBe(false);
  });

  it('deve limpar lock órfão e estado', async () => {
    const { passo, lockService, stateService } = criarPasso();

    lockService.checkLock.mockResolvedValueOnce({
      locked: false,
      pid: 99999,
      alive: false,
    });

    await passo.execute({ timeoutMs: 1000 });

    expect(lockService.forceReleaseLock).toHaveBeenCalledTimes(1);
    expect(stateService.clearState).toHaveBeenCalledTimes(1);
  });

  it('deve manter contexto limpo quando não há lock', async () => {
    const { passo } = criarPasso();

    // Mock padrão já retorna { locked: false, corrupted: false }
    const result = await passo.execute({ timeoutMs: 1000 });

    expect(result.lockAtivo).toBe(false);
    expect(result.processoFantasmaPid).toBeUndefined();
  });
});
