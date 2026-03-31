
// monitor/services/WorkspaceSnapshotService.ts
// ─────────────────────────────────────────────────────
// Serviço para capturar e comparar snapshots do workspace
// Baseado na implementação original do monitor.js
// ─────────────────────────────────────────────────────

import type { Logger } from '../interfaces/logger';

export type Snapshot = Map<string, number>; // caminho -> mtimeMs

export interface SnapshotComparison {
  modified: string[];
  created: string[];
  deleted: string[];
  totalChanges: number;
  hasChanges: boolean;
}

export interface WorkspaceSnapshotServiceDeps {
  logger: Logger;
  fileSystem: {
    readdir: (path: string, options?: { withFileTypes: true }) => Promise<Array<{ name: string; isDirectory: () => boolean }>>;
    stat: (path: string) => Promise<{ mtimeMs: number }>;
  };
}
export interface SnapshotInput {
    dir: string;
    ignoreList?: string[];
  }
export class WorkspaceSnapshotService {
  readonly logger: Logger;
  readonly fileSystem: WorkspaceSnapshotServiceDeps['fileSystem'];

  constructor(deps: WorkspaceSnapshotServiceDeps) {
    this.logger = deps.logger;
    this.fileSystem = deps.fileSystem;
  }

  

  /**
   * Tira um retrato de todos os arquivos do diretório e suas datas de modificação.
   * @param dir Diretório raiz para capturar
   * @param ignoreList Lista de nomes de diretórios/arquivos para ignorar
   * @returns Snapshot (Map<caminho, mtimeMs>)
   */
  async takeSnapshot( {
      dir, 
      ignoreList = ['node_modules', '.git', 'dist', 'build', '.next']
    }: SnapshotInput
    ): Promise<Snapshot> {
    await this.logger.debug(`📸 Capturando snapshot do diretório: ${dir}`);
    const snapshot = new Map<string, number>();

    const walk = async (currentDir: string): Promise<void> => {
      let entries;
      try {
        entries = await this.fileSystem.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        // Diretório não existe ou sem permissão
        return;
      }

      for (const entry of entries) {
        if (ignoreList.includes(entry.name)) continue;

        const fullPath = `${currentDir}/${entry.name}`;
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          try {
            const stat = await this.fileSystem.stat(fullPath);
            snapshot.set(fullPath, stat.mtimeMs);
          } catch (e) {
            // Ignora arquivos que desaparecem durante a leitura
          }
        }
      }
    };

    if (dir) await walk(dir);
    await this.logger.debug(`📸 Snapshot capturado: ${snapshot.size} arquivos`);
    return snapshot;
  }

  /**
   * Compara dois snapshots e retorna detalhes das mudanças
   * @param initialSnapshot Snapshot inicial
   * @param currentSnapshot Snapshot atual
   * @returns Objeto com arrays de arquivos modificados, criados e deletados
   */
  compareSnapshots(
    { initialSnapshot, currentSnapshot }: 
    { initialSnapshot: Snapshot, currentSnapshot: Snapshot }
  ): SnapshotComparison {
    const modified: string[] = [];
    const created: string[] = [];
    const deleted: string[] = [];

    // Verifica arquivos no snapshot atual
    for (const [filePath, currentMtime] of currentSnapshot.entries()) {
      const initialMtime = initialSnapshot.get(filePath);
      
      if (!initialMtime) {
        // Arquivo não existia no snapshot inicial (criado)
        created.push(filePath);
      } else if (currentMtime > initialMtime) {
        // Arquivo modificado (mtime maior)
        modified.push(filePath);
      }
    }

    // Verifica arquivos que existiam no inicial mas não no atual (deletados)
    for (const [filePath] of initialSnapshot.entries()) {
      if (!currentSnapshot.has(filePath)) {
        deleted.push(filePath);
      }
    }

    const totalChanges = modified.length + created.length + deleted.length;
    
    return {
      modified,
      created,
      deleted,
      totalChanges,
      hasChanges: totalChanges > 0,
    };
  }

  /**
   * Compara o snapshot inicial com o estado atual do diretório.
   * Retorna um array com os caminhos absolutos dos arquivos alterados ou criados.
   * @param initialSnapshot Snapshot inicial
   * @param dir Diretório para capturar snapshot atual
   * @param ignoreList Lista de ignorados
   * @returns Array de arquivos modificados/criados
   */
  async getModifiedFiles(
    initialSnapshot: Snapshot,
    dir: string,
    ignoreList: string[] = ['node_modules', '.git', 'dist', 'build', '.next', '.db', '.log']
  ): Promise<string[]> {
    const currentSnapshot = await this.takeSnapshot({ dir, ignoreList });
    const comparison = this.compareSnapshots({ initialSnapshot, currentSnapshot });
    
    return [...comparison.modified, ...comparison.created];
  }
}
