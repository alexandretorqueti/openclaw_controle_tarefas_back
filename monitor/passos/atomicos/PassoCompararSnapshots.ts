// monitor/passos/atomicos/PassoCompararSnapshots.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Comparar Snapshots do Workspace
// Compara snapshot inicial com snapshot atual e retorna
// lista de arquivos modificados, criados e deletados.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { Snapshot, SnapshotComparison } from '../../services/WorkspaceSnapshotService';

export interface CompararSnapshotsInput {
  snapshotInicial: Snapshot;
  diretorioAtual: string;
  // Ou passar snapshot atual diretamente (opcional)
  snapshotAtual?: Snapshot;
  ignorarPatterns?: string[];
}

export interface CompararSnapshotsOutput {
  sucesso: boolean;
  comparacao?: SnapshotComparison;
  temMudancas?: boolean;
  totalMudancas?: number;
  arquivosModificados?: string[];
  arquivosCriados?: string[];
  arquivosDeletados?: string[];
  mensagemErro?: string;
}

export interface ServicoSnapshot {
  takeSnapshot(dir: string, ignoreList?: string[]): Promise<Snapshot>;
  compareSnapshots(initial: Snapshot, current: Snapshot): SnapshotComparison;
}

export interface DependenciasCompararSnapshots extends DependenciasBase {
  snapshotService: ServicoSnapshot;
}

export class PassoCompararSnapshots extends PassoBase<CompararSnapshotsInput, CompararSnapshotsOutput> {
  readonly nome = 'Comparar Snapshots do Workspace';
  private readonly snapshotService: ServicoSnapshot;

  constructor(deps: DependenciasCompararSnapshots) {
    super(deps);
    this.snapshotService = deps.snapshotService;
  }

  protected async processar(input: CompararSnapshotsInput): Promise<CompararSnapshotsOutput> {
    try {
      await this.logger.info(`🔍 Comparando snapshots do diretório: ${input.diretorioAtual}`);
      
      // Capturar snapshot atual se não fornecido
      const snapshotAtual = input.snapshotAtual || 
        await this.snapshotService.takeSnapshot(input.diretorioAtual, input.ignorarPatterns);
      
      // Comparar snapshots
      const comparacao = this.snapshotService.compareSnapshots(input.snapshotInicial, snapshotAtual);
      
      await this.logger.info(
        `📊 Comparação concluída: ${comparacao.totalChanges} mudanças ` +
        `(${comparacao.created.length} criados, ${comparacao.modified.length} modificados, ${comparacao.deleted.length} deletados)`
      );
      
      if (comparacao.totalChanges > 0) {
        await this.logger.info(`📝 Arquivos alterados: ${[...comparacao.created, ...comparacao.modified].join(', ')}`);
      }
      
      return {
        sucesso: true,
        comparacao,
        temMudancas: comparacao.totalChanges > 0,
        totalMudancas: comparacao.totalChanges,
        arquivosModificados: comparacao.modified,
        arquivosCriados: comparacao.created,
        arquivosDeletados: comparacao.deleted,
      };
    } catch (error: any) {
      await this.logger.erro(`❌ Falha ao comparar snapshots: ${error.message}`);
      
      return {
        sucesso: false,
        mensagemErro: error.message,
      };
    }
  }
}