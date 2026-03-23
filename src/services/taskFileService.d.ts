declare const fs: any;
declare const path: any;
declare const fileExists: any, safeMoveFile: any, safeWriteFile: any, safeUnlink: any;
declare const formatInlineList: any, formatNumberedList: any;
declare const TaskAnalysisService: any;
declare class TaskFileService {
    /**
     * Construtor
     */
    constructor();
    /**
     * Gera os caminhos dos arquivos de uma tarefa
     * @param {string} taskId - ID da tarefa
     * @param {string} tasksDir - Diretorio de tarefas
     * @returns {Object}
     */
    getTaskFilePaths(taskId: any, tasksDir: any): {
        promptFile: any;
        relatorioFile: any;
        doneFile: any;
        terminalLogFile: any;
    };
    /**
     * Move arquivos de tarefa para um diretorio de destino
     * @param {string} taskId - ID da tarefa
     * @param {string} sourceDir - Diretorio de origem
     * @param {string} destinationDir - Diretorio de destino
     * @returns {Promise<void>}
     */
    moveTaskFiles(taskId: any, sourceDir: any, destinationDir: any): Promise<void>;
    /**
     * Prepara arquivos para execucao de uma tarefa
     * @param {Object} task - Tarefa
     * @param {string} tasksDir - Diretorio de tarefas
     * @param {Object} project - Projeto (opcional)
     * @param {Object} analysisPlan - Plano de analise (opcional)
     * @returns {Promise<Object>}
     */
    prepareTaskFiles(task: any, tasksDir: any, project?: any, analysisPlan?: any): Promise<{
        promptContent: string;
        analysisPlan: any;
        promptFile: any;
        relatorioFile: any;
        doneFile: any;
        terminalLogFile: any;
    }>;
    /**
     * Gera conteudo do prompt para a tarefa
     * @param {Object} task - Tarefa
     * @param {Object} project - Projeto
     * @param {Object} analysisPlan - Plano de analise
     * @param {Object} paths - Caminhos dos arquivos
     * @returns {string}
     */
    generatePromptContent(task: any, project: any, analysisPlan: any, paths: any): string;
    /**
     * Limpa arquivos de tarefa processada
     * @param {Object} files - Objeto com caminhos dos arquivos
     * @returns {Promise<void>}
     */
    cleanupFiles(files: any): Promise<void>;
}
