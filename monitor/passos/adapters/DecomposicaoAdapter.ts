// monitor/passos/adapters/DecomposicaoAdapter.ts
// ─────────────────────────────────────────────────────
// ADAPTER PARA O WORKFLOW ENGINE (Monitor)
//
// Une o Contexto (Motor) com o Passo Puro (Regra).
// Extrai o que é necessário e devolve as mutações.
// ─────────────────────────────────────────────────────

import type { Passo, ContextoExecucao } from '../../interfaces';
import { PassoDecompoeTarefa } from '../atomicos/PassoDecompoeTarefa';
import type { DependenciasDecompoeTarefa } from '../atomicos/PassoDecompoeTarefa';
import { FabricaPromptsIA } from '../../utils/fabricaPrompts';

export class PassoDecompoeTarefaAdapter implements Passo {
  readonly name = "Decompõe Tarefa";
  private readonly logicaPura: PassoDecompoeTarefa;

  constructor(deps: DependenciasDecompoeTarefa) {
    this.logicaPura = new PassoDecompoeTarefa(deps);
  }

  async execute(ctx: ContextoExecucao): Promise<void> {
    if (!ctx.tarefaAtual) return;

    // 1. O QUE ENTRA: Extrai apenas o que o passo precisa (Monta o Input)
    const inputParaDecomposicao = {
      tarefaAtual: ctx.tarefaAtual,
      userId: ctx.UserId,
      prompt: FabricaPromptsIA.gerarPromptDecomposicao(ctx.tarefaAtual),
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
