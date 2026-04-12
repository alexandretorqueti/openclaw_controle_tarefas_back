import type { Passo, ContextoExecucao } from '../../interfaces';
import { DecompoeTarefaOutput, PassoDecompoeTarefa } from '../atomicos/PassoDecompoeTarefa';

export class PassoDecompoeTarefaAdapter implements Passo {
  readonly name = 'Decompõe Tarefa';
  private readonly logicaPura: PassoDecompoeTarefa;

  constructor(deps: any) {
    this.logicaPura = new PassoDecompoeTarefa(deps);
  }

  async execute(ctx: ContextoExecucao): Promise<void> {
    if (!ctx.tarefaAtual) return;

    try {
      // Agora o passo atômico recebe o ContextoExecucao inteiro
      const resultado = await this.logicaPura.execute(ctx);

      if (!ctx.resultados) ctx.resultados = {} as any;
      
      // Mapeia o output do Zod para o contexto global
      ctx.resultados.decomposicao = {
        sucesso: resultado.success ?? false,
        precisaDividir: resultado.precisaDividir ?? false,
        subtasks: resultado.subtarefas ?? []
      } as DecompoeTarefaOutput;
    } catch (erro: unknown) {
      if (!ctx.erros) ctx.erros = {} as any;
      ctx.erros.decomposicao = true;
    }
  }
}
