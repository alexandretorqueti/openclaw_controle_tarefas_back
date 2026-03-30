// monitor/passos/atomicos/PassoVerificaLock.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Verifica se existe um lock ativo.
// Não conhece o ContextoExecucao. Recebe inputs estritos e
// devolve um resultado explícito da análise do lock.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { ServicoLock, ServicoEstado } from '../../interfaces';
import { segundosParaMinutosSegundos } from '../../utils/formatacao';

export interface VerificaLockInput {
  timeoutMs: number;
}

export interface VerificaLockOutput {
  lockAtivo: boolean;
  processoFantasmaPid?: number;
}

export interface DependenciasVerificaLock extends DependenciasBase {
  lockService: ServicoLock;
  stateService: ServicoEstado;
}

export class PassoVerificaLock extends PassoBase<VerificaLockInput, VerificaLockOutput> {
  readonly nome = 'Verifica Lock';

  private readonly lockService: ServicoLock;
  private readonly stateService: ServicoEstado;

  constructor(deps: DependenciasVerificaLock) {
    super(deps);
    this.lockService = deps.lockService;
    this.stateService = deps.stateService;
  }

  protected async processar(input: VerificaLockInput): Promise<VerificaLockOutput> {
    const resultado = await this.lockService.checkLock(input.timeoutMs);

    // Caso 1: Lock ativo e recente — respeita
    if (resultado.locked && resultado.ageRecent) {
      const idadeLegivel = resultado.mtime
        ? segundosParaMinutosSegundos((Date.now() - resultado.mtime) / 1000)
        : 'desconhecida';
      await this.logger.info(
        `🔒 Lock recente (${idadeLegivel}). Mantendo execução atual.`
      );
      return { lockAtivo: true };
    }

    // Caso 2: Lock antigo com processo ainda em pé — fantasma
    if (resultado.locked && !resultado.ageRecent) {
      return { 
        lockAtivo: false,
        processoFantasmaPid: resultado.pid ?? 0,
      };
    }

    // Caso 3: Lock corrompido — limpa
    if (resultado.corrupted) {
      await this.logger.info('⚠️ Lock corrompido. Limpando...');
      await this.lockService.forceReleaseLock();
      return { lockAtivo: false };
    }

    // Caso 4: Lock órfão (processo morto) — limpa tudo
    if (resultado.pid && !resultado.alive) {
      await this.logger.info('🧹 Lock órfão. Limpando...');
      await this.lockService.forceReleaseLock();
      await this.stateService.clearState();
      return { lockAtivo: false };
    }

    // Caso 5: Sem lock — fluxo normal
    return { lockAtivo: false };
  }
}
