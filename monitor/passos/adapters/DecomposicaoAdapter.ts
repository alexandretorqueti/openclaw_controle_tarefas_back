// monitor/passos/adapters/DecomposicaoAdapter.ts
// ─────────────────────────────────────────────────────
// ADAPTER PARA O WORKFLOW ENGINE (Monitor)
//
// Une o Contexto (Motor) com o Passo Puro (Regra).
// Extrai o que é necessário e devolve as mutações.
// ─────────────────────────────────────────────────────

import type { Passo, ContextoExecucao } from '../../interfaces';
import { StepName } from '../../interfaces';
import { LogicaDecomposicao } from '../atomicos/PassoDecompoeTarefa';
import type { DependenciasDecompoeTarefa } from '../atomicos/PassoDecompoeTarefa';

export class PassoDecompoeTarefaAdapter implements Passo {
  readonly name = StepName.DECOMPOE_TAREFA;
  private readonly logicaPura: LogicaDecomposicao;

  constructor(deps: DependenciasDecompoeTarefa) {
    this.logicaPura = new LogicaDecomposicao(deps);
  }

  async executar(ctx: ContextoExecucao): Promise<void> {
    if (!ctx.tarefaAtual) return;

    // 1. O QUE ENTRA: Extrai apenas o que o passo precisa (Monta o Input)
    const inputParaDecomposicao = {
      tarefaAtual: ctx.tarefaAtual,
      userId: ctx.UserId,
    };

    try {
      // 2. A MÁGICA: O Passo Executa livre de conhecimento sobre o contexto global
      const resultado = await this.logicaPura.execute(inputParaDecomposicao);

      // 3. O EFEITO COLATERAL: Centraliza a escrita e atualiza o contexto global com o resultado
      ctx.resultados.decomposicao = {
        sucesso: resultado.sucesso,
        subtasksCreated: resultado.quantidadeSubtarefas,
      };

    } catch (erro: unknown) {
      // Marca erro na esteira sem o passo precisar saber como fazer isso
      ctx.erros.decomposicao = true;
    }
  }
}
