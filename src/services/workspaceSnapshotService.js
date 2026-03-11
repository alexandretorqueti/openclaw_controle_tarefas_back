const fs = require('fs').promises;
const path = require('path');

class WorkspaceSnapshotService {
  /**
   * Tira um retrato de todos os arquivos do diretório e suas datas de modificação.
   */
  static async takeSnapshot(dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next']) {
    const snapshot = new Map();

    async function walk(currentDir) {
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
  static async getModifiedFiles(initialSnapshot, dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next']) {
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
}

module.exports = WorkspaceSnapshotService;