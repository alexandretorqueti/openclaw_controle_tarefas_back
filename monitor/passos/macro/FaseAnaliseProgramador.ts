// monitor/passos/macro/FaseAnaliseProgramador.ts
// ─────────────────────────────────────────────────────
// Macro Passo: Análise do Programador (Inspeciona Workspace)
// O orquestrador usa isso após o Programador sinalizar "feito".
// Ele vasculha o disco (via PassoManipularArquivo ou outro)
// pra ver se de fato os arquivos esperados foram criados (ex: .done).
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';

export interface AnaliseProgramadorInput {
  tarefaAtual: TarefaCompleta;
  caminhoTaskDir: string;
}

export interface AnaliseProgramadorOutput {
  workspaceValidado: boolean;
  arquivosAlterados?: boolean;
  mensagem?: string;
}

export interface ServicoArquivos {
  existe(caminho: string): Promise<boolean>;
}

export interface DependenciasAnaliseProgramador {
  logger: Logger;
  arquivos: ServicoArquivos;
}

export class MacroFaseAnaliseProgramador extends PassoBase<AnaliseProgramadorInput, AnaliseProgramadorOutput> {
  readonly nome = 'Análise do Programador (Inspeção)';
  private readonly arquivos: ServicoArquivos;

  constructor(deps: DependenciasAnaliseProgramador) {
    super(deps);
    this.arquivos = deps.arquivos;
  }

  protected async processar(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    await this.logger.info(`🔎 Inspecionando o workspace da tarefa [${input.tarefaAtual.id}]...`);

    // A regra de negócio: Se o programador terminou de verdade, tem que ter deixado um .done
    // (ou então ter commitado algo no git que não estamos validando nesta versão base).
    const arquivoDone = `${input.caminhoTaskDir}/.done`;

    const doneExists = await this.arquivos.existe(arquivoDone);

    if (doneExists) {
      await this.logger.info(`✅ Arquivo .done encontrado! O programador realmente entregou valor.`);
      return {
        workspaceValidado: true,
        arquivosAlterados: true,
      };
    } else {
      await this.logger.erro(`❌ Workspace analisado, mas nenhum .done foi encontrado. A IA mentiu.`);
      return {
        workspaceValidado: false,
        mensagem: 'O programador disse que terminou, mas não encontrei artefatos de entrega no disco.',
      };
    }
  }
}
