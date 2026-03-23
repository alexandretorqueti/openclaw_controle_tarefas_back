declare const fs: any;
declare const path: any;
declare const execSync: any;
declare const prisma: any;
declare const taskService: any;
declare const agentService: any;
declare const WorkspaceSnapshotService: any;
declare const OpenClawService: any;
declare const ContractVerificationService: any;
declare const EvidenceService: any;
declare const TaskAnalysisService: any;
declare const PromptFactory: any;
declare const SmartFileFinder: any;
declare const fileExists: any;
declare const runPipeline: any;
declare const log: any;
declare const arch: any;
declare const projectService: any;
declare class TaskExecutionService {
    static readTaskOutputFile(taskId: any, baseDir: any, fileType: any): Promise<any>;
    static createExecutionLog(task: any, userId: any, agentId: any): Promise<any>;
    static finishExecutionLog(logId: any, result: any): Promise<any>;
    /**
     * Passo 1: Prepara arquivos, banco de dados e analisa o escopo.
     */
    /**
       * Passo 1: Prepara arquivos, banco de dados e analisa o escopo.
       */
    static stepSetupContext(ctx: any): Promise<any>;
    /**
     * Passo 2: O Arquiteto analisa e, se possível, executa a tarefa.
     */
    static stepArchitectPlanning(ctx: any): Promise<any>;
    /**
     * Verifica se o arquiteto já executou a tarefa e se está tudo correto
     * @returns {Object|null} Retorna finalResult se arquiteto concluiu, ou null se precisa do desenvolvedor
     */
    static verifyArchitectWork(ctx: any): Promise<{
        needsDeveloper: boolean;
        message: any;
        success?: undefined;
        contractResult?: undefined;
        finalResult?: undefined;
    } | {
        success: boolean;
        contractResult: {
            contractFulfilled: boolean;
            executionNotes: string;
        };
        finalResult: {
            success: boolean;
            executionNotes: string;
        };
        needsDeveloper?: undefined;
        message?: undefined;
    }>;
    /**
     * Varredura de Ecossistema (Sistema 1)
     * Descobre automaticamente as aplicações dentro do projeto, usa IA para
     * entender a tecnologia de cada uma, e valida todas elas.
     */
    static ensureAndValidateEcosystem(task: any, project: any, config: any): Promise<{
        passed: boolean;
        message: string;
    } | {
        passed: boolean;
    }>;
    /**
     * Passo 3: O loop principal de execução do Jarbas (Desenvolvedor) - STATLESS (Protocolo Amnésia)
    */
    static stepDeveloperLoop(ctx: any): Promise<any>;
    /**
     * Passo 4: Finaliza o log no banco e consolida o resultado.
     */
    static stepTeardown(ctx: any): Promise<any>;
    static executeTask(task: any, userId: any, config: any): Promise<{
        success: any;
        executionNotes: any;
        taskId: any;
    }>;
}
