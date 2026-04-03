// monitor/passos/atomicos/PassoBuscaTarefa.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Busca a próxima tarefa elegível na fila.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';
import type { Logger } from '../../interfaces/logger';

export interface BuscaTarefaInput {
  nickname: string;
}

export interface BuscaTarefaOutput {
  tarefa: TarefaCompleta | null;
}

/** Contrato do buscador de tarefa (adapter sobre a API legada) */
export interface BuscadorTarefa {
  buscarProxima(nickname: string): Promise<TarefaCompleta | null>;
}

export interface DependenciasBuscaTarefa extends DependenciasBase {
  buscadorTarefa: BuscadorTarefa;
  logger: Logger
}

export class PassoBuscaTarefa extends PassoBase<BuscaTarefaInput, BuscaTarefaOutput> {
  readonly nome = 'Busca Tarefa';

  private readonly buscadorTarefa: BuscadorTarefa;

  constructor(deps: DependenciasBuscaTarefa) {
    super(deps);
    this.buscadorTarefa = deps.buscadorTarefa;
  }

  protected async processar(input: BuscaTarefaInput): Promise<BuscaTarefaOutput> {
    try {
      const tarefa = await this.buscadorTarefa.buscarProxima(input.nickname);

      if (!tarefa) {
        return { tarefa: null }; // Fila vazia — o orquestrador cuida de encerrar
      }

      await this.logger.info(`🎯 Tarefa capturada: [${tarefa.id}] ${tarefa.title}`);
      return { tarefa };
      
    } catch (error: unknown) {
      const mensagem = error instanceof Error ? error.message : String(error);
      await this.logger.erro(
        `⚠️ Falha na comunicação ao buscar tarefa: ${mensagem}`
      );
      return { tarefa: null };
    }
  }
}
