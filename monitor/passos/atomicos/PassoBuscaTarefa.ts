// monitor/passos/atomicos/PassoBuscaTarefa.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Busca a próxima tarefa elegível na fila.
// ─────────────────────────────────────────────────────

import type { ContextoExecucao, Passo, TarefaCompleta } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';

/** Contrato do buscador de tarefa (adapter sobre a API legada) */
export interface BuscadorTarefa {
  buscarProxima(nickname: string): Promise<TarefaCompleta | null>;
}

export interface DependenciasBuscaTarefa {
  logger: Logger;
  buscadorTarefa: BuscadorTarefa;
}

export class PassoBuscaTarefa implements Passo {
  readonly name = "Busca Tarefa";

  private readonly logger: Logger;
  private readonly buscadorTarefa: BuscadorTarefa;

  constructor(deps: DependenciasBuscaTarefa) {
    this.logger = deps.logger;
    this.buscadorTarefa = deps.buscadorTarefa;
  }

  async execute(ctx: ContextoExecucao): Promise<void> {
    const nickname = ctx.config.MY_USER_NICKNAME;

    try {
      const tarefa = await this.buscadorTarefa.buscarProxima(nickname);

      if (!tarefa) {
        ctx.tarefaAtual = null;
        return; // Fila vazia — o mapa cuida de encerrar
      }

      ctx.tarefaAtual = tarefa;
      ctx.project = tarefa.project;
      await this.logger.info(`🎯 Tarefa capturada: [${tarefa.id}] ${tarefa.title}`);
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.logger.erro(
        `⚠️ Falha na comunicação ao buscar tarefa: ${mensagem}`
      );
      ctx.tarefaAtual = null;
    }
  }
}
