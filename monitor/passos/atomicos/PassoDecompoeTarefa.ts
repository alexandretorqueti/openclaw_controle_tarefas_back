// monitor/passos/atomicos/PassoDecompoeTarefa.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Decomposição de tarefas não atômicas.
//
// Recebe apenas Input e devolve Output estritos.
// Não conhece o ContextoExecucao.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';

// 1. O QUE ENTRA (Sem "Deus Contexto")
export interface DecomposicaoInput {
  tarefaAtual: TarefaCompleta;
  userId: string | null;
}

// 2. O QUE SAI
export interface DecomposicaoOutput {
  sucesso: boolean;
  quantidadeSubtarefas: number;
}

// 3. CONTRATO DO SERVIÇO DE NEGÓCIO
export interface ServicoAnalistaTarefa {
  decompor(tarefa: TarefaCompleta, userId: string | null): Promise<DecomposicaoOutput>;
}

export interface DependenciasDecompoeTarefa extends DependenciasBase {
  analista: ServicoAnalistaTarefa;
}

// 4. A CLASSE PURA (A Regra de Negócio)
export class LogicaDecomposicao extends PassoBase<DecomposicaoInput, DecomposicaoOutput> {
  readonly nome = "Decompõe Tarefa";
  private readonly analista: ServicoAnalistaTarefa;

  constructor(deps: DependenciasDecompoeTarefa) {
    super(deps);
    this.analista = deps.analista;
  }

  protected async processar(input: DecomposicaoInput): Promise<DecomposicaoOutput> {
    await this.logger.info(
      `🔍 Solicitando decomposição ao Analista (Tarefa: ${input.tarefaAtual.id})...`
    );

    const resultado = await this.analista.decompor(input.tarefaAtual, input.userId);

    if (resultado.quantidadeSubtarefas > 0) {
      await this.logger.info(
        `✅ Tarefa-mãe decomposta em ${resultado.quantidadeSubtarefas} subtarefa(s).`
      );
    } else {
      await this.logger.info(
        `⚠️ Analista não criou subtarefas para a tarefa [${input.tarefaAtual.id}].`
      );
    }

    return resultado;
  }
}
