// monitor/passos/atomicos/PassoConfiguraUsuario.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Resolve o usuário ativo do monitor.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { ServicoUsuario } from '../../interfaces';

export interface ConfiguraUsuarioInput {
  nickname: string;
}

export interface ConfiguraUsuarioOutput {
  userId: string | null;
}

export interface DependenciasConfiguraUsuario extends DependenciasBase {
  userService: ServicoUsuario;
}

export class PassoConfiguraUsuario extends PassoBase<ConfiguraUsuarioInput, ConfiguraUsuarioOutput> {
  readonly nome = 'Configura Usuário';

  private readonly userService: ServicoUsuario;

  constructor(deps: DependenciasConfiguraUsuario) {
    super(deps);
    this.userService = deps.userService;
  }

  protected async processar(input: ConfiguraUsuarioInput): Promise<ConfiguraUsuarioOutput> {
    const usuario = await this.userService.getCurrentUser(input.nickname);

    if (!usuario) {
      await this.logger.erro(
        `❌ Usuário "${input.nickname}" não encontrado. Ciclo continuará sem UserId.`
      );
      return { userId: null };
    }

    await this.logger.info(`👤 Usuário configurado: ${usuario.nickname} (${usuario.id})`);
    return { userId: usuario.id };
  }
}
