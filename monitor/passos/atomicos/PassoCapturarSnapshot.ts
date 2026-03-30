// monitor/passos/atomicos/PassoCapturarSnapshot.ts
// ─────────────────────────────────────────────────────
// Passo Atômico: Capturar Snapshot do Workspace
// Tira uma "foto" do diretório base (ou taskDir) antes do programador começar
// e salva no contexto para comparação posterior.
// ─────────────────────────────────────────────────────

import { PassoBase } from '../PassoBase';
import type { DependenciasBase } from '../PassoBase';
import type { Snapshot } from '../../services/WorkspaceSnapshotService';

export interface CapturarSnapshotInput {
  diretorio: string;
  salvarNoContextoComo?: string; // default: 'initialSnapshot'
}

export interface CapturarSnapshotOutput {
  sucesso: boolean;
  snapshot?: Snapshot;
  totalArquivos?: number;
  mensagemErro?: string;
}

export interface ServicoSnapshot {
  takeSnapshot(dir: string, ignoreList?: string[]): Promise<Snapshot>;
}

export interface DependenciasCapturarSnapshot extends DependenciasBase {
  snapshotService: ServicoSnapshot;
}

export class PassoCapturarSnapshot extends PassoBase<CapturarSnapshotInput, CapturarSnapshotOutput> {
  readonly nome = 'Capturar Snapshot do Workspace';
  private readonly snapshotService: ServicoSnapshot;

  constructor(deps: DependenciasCapturarSnapshot) {
    super(deps);
    this.snapshotService = deps.snapshotService;
  }

  protected async processar(input: CapturarSnapshotInput): Promise<CapturarSnapshotOutput> {
    try {
      await this.logger.info(`📸 Capturando snapshot do diretório: ${input.diretorio}`);
      
      const snapshot = await this.snapshotService.takeSnapshot(input.diretorio);
      
      await this.logger.info(`✅ Snapshot capturado: ${snapshot.size} arquivos`);
      
      return {
        sucesso: true,
        snapshot,
        totalArquivos: snapshot.size,
      };
    } catch (error: any) {
      await this.logger.erro(`❌ Falha ao capturar snapshot: ${error.message}`);
      
      return {
        sucesso: false,
        mensagemErro: error.message,
      };
    }
  }
}