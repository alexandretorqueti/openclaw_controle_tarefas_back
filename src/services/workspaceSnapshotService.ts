// Migrado para TypeScript - Fase: Services
// Arquivo: workspaceSnapshotService.js

export import fs from 'fs/promises';
import * as path from 'path';

class WorkspaceSnapshotService {
  /**
   * Tira um retrato de todos os arquivos do diretório e suas datas de modificação.
   */
  static async takeSnapshot(dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next']): Promise<any> {
    const snapshot = new Map();

    async function walk(currentDir: any): any {
      let entries;
      try {
        entries = await fs.readdir(currentDir, { withFileTypes: true });
      } catch (e) {
        return; // Diretório não existe ou sem permissão
      }

      for (const entry of entries) {
        if (ignoreList.includes(entry.name)) continue;

        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
        } else {
          try {
            const stat = await fs.stat(fullPath);
            snapshot.set(fullPath, stat.mtimeMs);
          } catch (e) {
            // Ignora arquivos que desaparecem durante a leitura
          }
        }
      }
    }

    if (dir) await walk(dir);
    return snapshot;
  }

  /**
   * Compara o snapshot inicial com o estado atual do diretório.
   * Retorna um array com os caminhos absolutos dos arquivos alterados ou criados.
   */
  static async getModifiedFiles(initialSnapshot, dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next', '.db', '.log']): Promise<any> {
    const modifiedFiles = [];
    const currentSnapshot = await this.takeSnapshot(dir, ignoreList);

    for (const [filePath, currentMtime] of currentSnapshot.entries()) {
      const initialMtime = initialSnapshot.get(filePath);
      
      // Se não existia antes (novo) ou a data de modificação é maior (editado)
      if (!initialMtime || currentMtime > initialMtime) {
        modifiedFiles.push(filePath);
      }
    }

    return modifiedFiles;
  }

  /**
   * Compara dois snapshots e retorna detalhes das mudanças
   * @param {Map} initialSnapshot - Snapshot inicial
   * @param {Map} currentSnapshot - Snapshot atual
   * @returns {Object} Objeto com arrays de arquivos modificados, criados e deletados
   */
  static compareSnapshots(initialSnapshot, currentSnapshot) {
    const modified = [];
    const created = [];
    const deleted = [];

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

    return {
      modified,
      created,
      deleted,
      totalChanges: modified.length + created.length + deleted.length
    };
  }
}

export default WorkspaceSnapshotService;