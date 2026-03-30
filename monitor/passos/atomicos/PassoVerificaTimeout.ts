// monitor/passos/atomicos/PassoVerificaTimeout.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Lida com processo fantasma detectado.
//
// Quando o VerificaLock detecta um lock antigo com
// processo vivo, este passo registra a situação e
// encerra o ciclo para intervenção humana.
// ─────────────────────────────────────────────────────

import type { ContextoExecucao, Passo } from '../../interfaces';
import { StepName } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';

export interface DependenciasVerificaTimeout {
  logger: Logger;
}

export class PassoVerificaTimeout implements Passo {
  readonly name = StepName.VERIFICA_TIMEOUT;

  private readonly logger: Logger;

  constructor(deps: DependenciasVerificaTimeout) {
    this.logger = deps.logger;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    const fantasma = ctx.controleExecucao.processoFantasma;

    if (!fantasma) {
      await this.logger.info(
        '⚠️ Verifica Timeout chamado sem processo fantasma no contexto.'
      );
      return;
    }

    await this.logger.erro(
      `👻 Processo fantasma detectado (PID: ${fantasma.pid}). ` +
        'Lock antigo com processo ainda em execução. ' +
        'Ciclo encerrado para intervenção manual.'
    );
  }
}
