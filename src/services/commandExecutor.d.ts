declare const fs: any;
declare const path: any;
declare const crypto: any;
declare const exec: any;
declare class CommandExecutor {
    /**
     * Executa a ferramenta baseada no JSON extraído do output da IA
     * @param {Object} toolCall - Ex: { name: 'exec', arguments: { command: '...' } }
     * @param {string} cwd - Diretório de trabalho do projeto
     * @returns {Object}
     */
    static executeTool(toolCall: any, cwd?: string): Promise<{
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    }>;
    static buildResult(success: any, data?: {}): {
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    };
    static resolveFilePath(filePath: any, cwd: any): any;
    static truncateOutput(text: any, max?: number): string;
    static executeExecWithRealMutationCheck(command: any, cwd?: string): Promise<{
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    }>;
    static executeReadCommand(filePath: any, cwd: any): {
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    };
    static executeWriteCommand(filePath: any, content: any, cwd: any): {
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    };
    static executeEditCommand(filePath: any, oldText: any, newText: any, cwd: any): {
        success: boolean;
        output: any;
        error: any;
        stdout: any;
        stderr: any;
        exitCode: any;
        filesRead: any[];
        filesWritten: any[];
        modifiedFiles: any[];
        touchedFiles: any[];
        commandsExecuted: any;
        executionDiagnostics: any;
    };
}
declare function unique(values?: any[]): any[];
declare function runShellCommand(command: any, options?: {}): Promise<unknown>;
