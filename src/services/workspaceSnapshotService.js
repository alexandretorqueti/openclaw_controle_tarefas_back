var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const fs = require('fs').promises;
const path = require('path');
class WorkspaceSnapshotService {
    /**
     * Tira um retrato de todos os arquivos do diretório e suas datas de modificação.
     */
    static takeSnapshot(dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next']) {
        return __awaiter(this, void 0, void 0, function* () {
            const snapshot = new Map();
            function walk(currentDir) {
                return __awaiter(this, void 0, void 0, function* () {
                    let entries;
                    try {
                        entries = yield fs.readdir(currentDir, { withFileTypes: true });
                    }
                    catch (e) {
                        return; // Diretório não existe ou sem permissão
                    }
                    for (const entry of entries) {
                        if (ignoreList.includes(entry.name))
                            continue;
                        const fullPath = path.join(currentDir, entry.name);
                        if (entry.isDirectory()) {
                            yield walk(fullPath);
                        }
                        else {
                            try {
                                const stat = yield fs.stat(fullPath);
                                snapshot.set(fullPath, stat.mtimeMs);
                            }
                            catch (e) {
                                // Ignora arquivos que desaparecem durante a leitura
                            }
                        }
                    }
                });
            }
            if (dir)
                yield walk(dir);
            return snapshot;
        });
    }
    /**
     * Compara o snapshot inicial com o estado atual do diretório.
     * Retorna um array com os caminhos absolutos dos arquivos alterados ou criados.
     */
    static getModifiedFiles(initialSnapshot, dir, ignoreList = ['node_modules', '.git', 'dist', 'build', '.next', '.db', '.log']) {
        return __awaiter(this, void 0, void 0, function* () {
            const modifiedFiles = [];
            const currentSnapshot = yield this.takeSnapshot(dir, ignoreList);
            for (const [filePath, currentMtime] of currentSnapshot.entries()) {
                const initialMtime = initialSnapshot.get(filePath);
                // Se não existia antes (novo) ou a data de modificação é maior (editado)
                if (!initialMtime || currentMtime > initialMtime) {
                    modifiedFiles.push(filePath);
                }
            }
            return modifiedFiles;
        });
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
            }
            else if (currentMtime > initialMtime) {
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
module.exports = WorkspaceSnapshotService;
