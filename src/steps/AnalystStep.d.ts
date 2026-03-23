/**
 * Step responsável por analisar e decompor tarefas complexas usando OpenClaw.
 * Implementa o padrão Pipeline Step com injeção via container para testabilidade.
 */
declare const container: any;
declare class AnalystStep {
    /**
     * Construtor que obtém todas as dependências do container.
     * Para testes, o container deve ser previamente configurado com mocks.
     */
    constructor();
    /**
     * Executa o step de análise para uma tarefa
     * @param {Object} context - Contexto do pipeline
     * @param {Object} context.task - Tarefa a ser analisada
     * @param {Object} context.project - Projeto relacionado (opcional)
     * @returns {Promise<Object>} Contexto atualizado com resultado da análise
     */
    execute(context: any): Promise<any>;
    /**
     * Adiciona um comentário a uma tarefa
     * @private
     */
    _addComment(taskId: any, content: any, userId?: any): Promise<void>;
}
