// monitor/passos/macro/FaseAnaliseProgramador.ts
// ─────────────────────────────────────────────────────
// Macro Passo: Análise do Programador (Inspeciona Workspace)
// O orquestrador usa isso após o Programador sinalizar "feito".
// Ele compara snapshots (antes/depois) para detectar mudanças reais,
// com fallback para o arquivo .done para compatibilidade.
// ─────────────────────────────────────────────────────

import type { Logger } from '../../interfaces/logger';
import { PassoBase } from '../PassoBase';
import type { TarefaCompleta } from '../../interfaces';
import type { Snapshot, SnapshotComparison } from '../../services/WorkspaceSnapshotService';

export interface AnaliseProgramadorInput {
  tarefaAtual: TarefaCompleta;
  caminhoTaskDir: string;
  snapshotInicial?: Snapshot; // Snapshot capturado antes do programador
  diretorioBase?: string; // Diretório base do projeto para comparação (opcional, usa caminhoTaskDir se não fornecido)
}

export interface AnaliseProgramadorOutput {
  workspaceValidado: boolean;
  arquivosAlterados?: boolean;
  mensagem?: string;
  comparacao?: SnapshotComparison;
  arquivosModificados?: string[];
  arquivosCriados?: string[];
  arquivosDeletados?: string[];
}

export interface ServicoArquivos {
  existe(caminho: string): Promise<boolean>;
}

export interface ServicoSnapshot {
  takeSnapshot(dir: string, ignoreList?: string[]): Promise<Snapshot>;
  compareSnapshots(initial: Snapshot, current: Snapshot): SnapshotComparison;
}

export interface DependenciasAnaliseProgramador {
  logger: Logger;
  arquivos: ServicoArquivos;
  snapshotService?: ServicoSnapshot; // Opcional: se fornecido, usa comparação de snapshots
}

export class MacroFaseAnaliseProgramador extends PassoBase<AnaliseProgramadorInput, AnaliseProgramadorOutput> {
  readonly nome = 'Análise do Programador (Inspeção)';
  private readonly arquivos: ServicoArquivos;
  private readonly snapshotService?: ServicoSnapshot;

  constructor(deps: DependenciasAnaliseProgramador) {
    super(deps);
    this.arquivos = deps.arquivos;
    this.snapshotService = deps.snapshotService;
  }

  protected async processar(input: AnaliseProgramadorInput): Promise<AnaliseProgramadorOutput> {
    await this.logger.info(`🔎 Inspecionando o workspace da tarefa [${input.tarefaAtual.id}]...`);

    // 1. Verificação tradicional do arquivo .done (fallback)
    const arquivoDone = `${input.caminhoTaskDir}/.done`;
    const doneExists = await this.arquivos.existe(arquivoDone);

    // 2. Se temos serviço de snapshot e snapshot inicial, fazer comparação avançada
    if (this.snapshotService && input.snapshotInicial) {
      const diretorioParaComparar = input.diretorioBase || input.caminhoTaskDir;
      
      await this.logger.info(`📸 Comparando snapshots do diretório: ${diretorioParaComparar}`);
      
      try {
        const snapshotAtual = await this.snapshotService.takeSnapshot(diretorioParaComparar);
        const comparacao = this.snapshotService.compareSnapshots(input.snapshotInicial, snapshotAtual);
        
        await this.logger.info(
          `📊 Comparação concluída: ${comparacao.totalChanges} mudanças ` +
          `(${comparacao.created.length} criados, ${comparacao.modified.length} modificados, ${comparacao.deleted.length} deletados)`
        );

        const temMudancasReais = comparacao.totalChanges > 0;
        
        if (temMudancasReais) {
          await this.logger.info(`✅ Mudanças reais detectadas no workspace!`);
          return {
            workspaceValidado: true,
            arquivosAlterados: true,
            comparacao,
            arquivosModificados: comparacao.modified,
            arquivosCriados: comparacao.created,
            arquivosDeletados: comparacao.deleted,
          };
        } else if (doneExists) {
          // Sem mudanças mas tem .done (programador pode ter feito algo que não alterou arquivos)
          await this.logger.info(`✅ Arquivo .done encontrado (sem mudanças detectadas).`);
          return {
            workspaceValidado: true,
            arquivosAlterados: false,
            comparacao,
          };
        } else {
          await this.logger.erro(`❌ Nenhuma mudança detectada e nenhum .done encontrado. A IA mentiu.`);
          return {
            workspaceValidado: false,
            mensagem: 'O programador disse que terminou, mas não detectei mudanças no workspace nem arquivo .done.',
            comparacao,
          };
        }
      } catch (error: any) {
        await this.logger.erro(`❌ Erro na comparação de snapshots: ${error.message}`);
        // Fallback para verificação do .done
      }
    }

    // 3. Fallback: verificação tradicional do .done
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
