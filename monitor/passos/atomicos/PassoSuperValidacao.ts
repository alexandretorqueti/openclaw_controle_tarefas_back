// monitor/passos/atomicos/PassoSuperValidacao.ts
// ─────────────────────────────────────────────────────
// Passo Atômico PURO: Validações críticas pós-inicialização.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { TarefaCompleta, PlanoDeAnalise, ServicoAnaliseTarefa } from '../../interfaces';

export interface SuperValidacaoInput {
  tarefa: TarefaCompleta;
}

export interface SuperValidacaoOutput {
  valido: boolean;
  planoDeAnalise?: PlanoDeAnalise;
}

export interface DependenciasSuperValidacao extends DependenciasBase {
  taskAnalysisService?: ServicoAnaliseTarefa;
}

export class PassoSuperValidacao extends PassoBase<SuperValidacaoInput, SuperValidacaoOutput> {
  readonly nome = 'Super Validação';
  private readonly taskAnalysisService?: ServicoAnaliseTarefa;

  constructor(deps: DependenciasSuperValidacao) {
    super(deps);
    this.taskAnalysisService = deps.taskAnalysisService;
  }

  protected async processar(input: SuperValidacaoInput): Promise<SuperValidacaoOutput> {
    const logPrefix = `[${this.nome}]`;
    const tarefa = input.tarefa;

    // 1. Validação de campos obrigatórios
    const camposObrigatorios = ['id', 'title', 'description', 'statusId', 'projectId'];
    for (const campo of camposObrigatorios) {
      if (!(campo in (tarefa as any))) {
        await this.logger.erro(
          `${logPrefix} Campo obrigatório faltando: ${campo} na tarefa ${tarefa.id}`
        );
        return { valido: false };
      }
    }

    // 2. Validação do projeto
    if (!tarefa.project) {
      await this.logger.erro(
        `${logPrefix} Projeto não é válido para tarefa ${tarefa.id}`
      );
      return { valido: false };
    }

    // 3. Análise preliminar da tarefa
    let plano: PlanoDeAnalise | undefined;
    if (this.taskAnalysisService) {
      plano = await this.taskAnalysisService.analyzeTaskScope(tarefa, tarefa.project);
      await this.logger.info(
        `${logPrefix} ✅ Análise concluída para tarefa ${tarefa.id}`
      );
    }

    return {
      valido: true,
      planoDeAnalise: plano,
    };
  }
}
