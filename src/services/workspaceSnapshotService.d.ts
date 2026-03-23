declare const fs: any;
declare const path: any;
declare class WorkspaceSnapshotService {
    /**
     * Tira um retrato de todos os arquivos do diretório e suas datas de modificação.
     */
    static takeSnapshot(dir: any, ignoreList?: string[]): Promise<Map<any, any>>;
    /**
     * Compara o snapshot inicial com o estado atual do diretório.
     * Retorna um array com os caminhos absolutos dos arquivos alterados ou criados.
     */
    static getModifiedFiles(initialSnapshot: any, dir: any, ignoreList?: string[]): Promise<any[]>;
    /**
     * Compara dois snapshots e retorna detalhes das mudanças
     * @param {Map} initialSnapshot - Snapshot inicial
     * @param {Map} currentSnapshot - Snapshot atual
     * @returns {Object} Objeto com arrays de arquivos modificados, criados e deletados
     */
    static compareSnapshots(initialSnapshot: any, currentSnapshot: any): {
        modified: any[];
        created: any[];
        deleted: any[];
        totalChanges: number;
    };
}
