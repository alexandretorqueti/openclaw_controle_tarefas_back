declare const path: any;
declare const mergeUniquePaths: any, uniquePaths: any;
declare const inferReadOnlyEvidenceFromCommand: any;
declare const isEphemeralArtifact: any;
declare class EvidenceService {
    /**
     * Cria um objeto de evidências vazio.
     */
    static createEmptyEvidence(): {
        toolsUsed: any[];
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any[];
        noOpMutations: any[];
    };
    /**
     * Ignora arquivos de backup comuns criados por ferramentas como sed (-i.bak, etc)
     */
    static isBackupFile(filePath: any): any;
    /**
     * Aplica o resultado de uma chamada de ferramenta ao objeto de evidências.
     * Modificado para inferir as intenções da IA diretamente do JSON, garantindo
     * que arquivos editados sejam rastreados mesmo se o executor falhar em reportá-los.
     */
    static applyExecutionEvidence(executionEvidence: any, toolCall: any, toolResult?: {}, options?: {}): any;
    /**
     * Calcula o progresso do turno atual, filtrando artefatos efêmeros.
     */
    static computeTurnProgress(toolResult?: {}, contractResult?: {}, cwd?: string): {
        meaningfulReads: any;
        meaningfulMutations: any;
        touchedFiles: any;
        noOpMutation: boolean;
        hasMeaningfulProgress: boolean;
    };
}
