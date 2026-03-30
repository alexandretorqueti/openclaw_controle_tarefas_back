// monitor/passos/atomicos/PassoVerificaLock.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Verifica se existe um lock ativo.
//
// Responsabilidade única:
//   - Checar o estado do lock
//   - Setar flags no contexto para o motor de rotas decidir
// ─────────────────────────────────────────────────────

import type { ContextoExecucao, Passo, ServicoLock, ServicoEstado } from '../../interfaces';
import { StepName } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';
import { segundosParaMinutosSegundos } from '../../utils/formatacao';

export interface DependenciasVerificaLock {
  logger: Logger;
  lockService: ServicoLock;
  stateService: ServicoEstado;
}

export class PassoVerificaLock implements Passo {
  readonly name = StepName.VERIFICA_LOCK;

  private readonly logger: Logger;
  private readonly lockService: ServicoLock;
  private readonly stateService: ServicoEstado;

  constructor(deps: DependenciasVerificaLock) {
    this.logger = deps.logger;
    this.lockService = deps.lockService;
    this.stateService = deps.stateService;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    ctx.lockAtivo = false;
    ctx.controleExecucao.processoFantasma = undefined;

    const resultado = await this.lockService.checkLock(ctx.config.TASK_TIMEOUT_MS);

    // Caso 1: Lock ativo e recente — respeita
    if (resultado.locked && resultado.ageRecent) {
      ctx.lockAtivo = true;
      const idadeLegivel = resultado.mtime
        ? segundosParaMinutosSegundos((Date.now() - resultado.mtime) / 1000)
        : 'desconhecida';
      await this.logger.info(
        `🔒 Lock recente (${idadeLegivel}). Mantendo execução atual.`
      );
      return;
    }

    // Caso 2: Lock antigo com processo ainda em pé — fantasma
    if (resultado.locked && !resultado.ageRecent) {
      ctx.controleExecucao.processoFantasma = {
        pid: resultado.pid ?? 0,
      };
      return;
    }

    // Caso 3: Lock corrompido — limpa
    if (resultado.corrupted) {
      await this.logger.info('⚠️ Lock corrompido. Limpando...');
      await this.lockService.forceReleaseLock();
      return;
    }

    // Caso 4: Lock órfão (processo morto) — limpa tudo
    if (resultado.pid && !resultado.alive) {
      await this.logger.info('🧹 Lock órfão. Limpando...');
      await this.lockService.forceReleaseLock();
      await this.stateService.clearState();
    }

    // Caso 5: Sem lock — fluxo normal (ctx.lockAtivo continua false)
  }
}
