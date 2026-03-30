// monitor/passos/atomicos/PassoVerificaTimeout.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Lida com processo fantasma detectado.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';

export interface VerificaTimeoutInput {
  processoFantasmaPid: number;
}

export interface VerificaTimeoutOutput {
  encerrado: boolean;
}

export class PassoVerificaTimeout extends PassoBase<VerificaTimeoutInput, VerificaTimeoutOutput> {
  readonly nome = 'Verifica Timeout';

  constructor(deps: DependenciasBase) {
    super(deps);
  }

  protected async processar(input: VerificaTimeoutInput): Promise<VerificaTimeoutOutput> {
    await this.logger.erro(
      `👻 Processo fantasma detectado (PID: ${input.processoFantasmaPid}). ` +
        'Lock antigo com processo ainda em execução. ' +
        'Ciclo encerrado para intervenção manual.'
    );

    return { encerrado: true };
  }
}
