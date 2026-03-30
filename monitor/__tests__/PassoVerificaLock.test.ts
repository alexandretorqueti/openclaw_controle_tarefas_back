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
    const ctx = criarContextoMock();

    lockService.checkLock.mockResolvedValueOnce({
      locked: true,
      ageRecent: true,
      mtime: Date.now() - 5000,
    });

    await passo.executar(ctx);

    expect(ctx.lockAtivo).toBe(true);
    expect(ctx.controleExecucao.processoFantasma).toBeUndefined();
  });

  it('deve detectar processo fantasma quando lock é antigo', async () => {
    const { passo, lockService } = criarPasso();
    const ctx = criarContextoMock();

    lockService.checkLock.mockResolvedValueOnce({
      locked: true,
      ageRecent: false,
      pid: 12345,
    });

    await passo.executar(ctx);

    expect(ctx.lockAtivo).toBe(false);
    expect(ctx.controleExecucao.processoFantasma).toEqual({ pid: 12345 });
  });

  it('deve limpar lock corrompido', async () => {
    const { passo, lockService } = criarPasso();
    const ctx = criarContextoMock();

    lockService.checkLock.mockResolvedValueOnce({
      locked: false,
      corrupted: true,
    });

    await passo.executar(ctx);

    expect(lockService.forceReleaseLock).toHaveBeenCalledTimes(1);
    expect(ctx.lockAtivo).toBe(false);
  });

  it('deve limpar lock órfão e estado', async () => {
    const { passo, lockService, stateService } = criarPasso();
    const ctx = criarContextoMock();

    lockService.checkLock.mockResolvedValueOnce({
      locked: false,
      pid: 99999,
      alive: false,
    });

    await passo.executar(ctx);

    expect(lockService.forceReleaseLock).toHaveBeenCalledTimes(1);
    expect(stateService.clearState).toHaveBeenCalledTimes(1);
  });

  it('deve manter contexto limpo quando não há lock', async () => {
    const { passo } = criarPasso();
    const ctx = criarContextoMock();

    // Mock padrão já retorna { locked: false, corrupted: false }
    await passo.executar(ctx);

    expect(ctx.lockAtivo).toBe(false);
    expect(ctx.controleExecucao.processoFantasma).toBeUndefined();
  });
});
