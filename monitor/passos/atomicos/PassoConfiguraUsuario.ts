// monitor/passos/atomicos/PassoConfiguraUsuario.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Resolve o usuário ativo do monitor.
// ─────────────────────────────────────────────────────

import type { ContextoExecucao, Passo, ServicoUsuario } from '../../interfaces';
import { StepName } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';

export interface DependenciasConfiguraUsuario {
  logger: Logger;
  userService: ServicoUsuario;
}

export class PassoConfiguraUsuario implements Passo {
  readonly name = StepName.CONFIGURA_USUARIO;

  private readonly logger: Logger;
  private readonly userService: ServicoUsuario;

  constructor(deps: DependenciasConfiguraUsuario) {
    this.logger = deps.logger;
    this.userService = deps.userService;
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    const nickname = ctx.config.MY_USER_NICKNAME;

    const usuario = await this.userService.getCurrentUser(nickname);

    if (!usuario) {
      await this.logger.erro(
        `❌ Usuário "${nickname}" não encontrado. Ciclo continuará sem UserId.`
      );
      return;
    }

    ctx.UserId = usuario.id;
    await this.logger.info(`👤 Usuário configurado: ${usuario.nickname} (${usuario.id})`);
  }
}
