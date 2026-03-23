declare const fs: any;
declare const path: any;
declare const resolveProjectPath: any, isPathInside: any;
declare const isInspectionCommand: any, commandTargetsOnlySpecialFiles: any, isMeaningfulCommand: any;
declare const TaskAnalysisService: any;
declare const WorkspaceSnapshotService: any;
declare const validationRules: any;
declare class ContractVerificationService {
    /**
       * Verifica se o contrato da tarefa foi cumprido
       * @param {string} doneFile - Caminho do arquivo .done
       * @param {string} relatorioFile - Caminho do arquivo de relatorio
       * @param {string} terminalLogFile - Caminho do log de terminal
       * @param {Object} options - Opcoes de verificacao
       * @returns {Promise<Object>}
       */
    static verifyContract(doneFile: any, relatorioFile: any, terminalLogFile: any, options?: {}): Promise<any>;
}
