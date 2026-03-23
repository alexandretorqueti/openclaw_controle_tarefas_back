/**
 * Step responsável por adicionar comentários a tarefas.
 * Usa o container para obter todas as dependências necessárias.
 */
declare const container: any;
declare class AddCommentStep {
    /**
     * Construtor que obtém todas as dependências do container.
     */
    constructor();
    /**
     * Executa o step de adição de comentário
     * @param {Object} context - Contexto do pipeline
     * @param {string} context.taskId - ID da tarefa
     * @param {string} context.content - Conteúdo do comentário
     * @param {string} context.userId - ID do usuário (opcional, pode vir do contexto global)
     * @returns {Promise<Object>} Contexto atualizado
     */
    execute(context: any): Promise<any>;
    /**
     * Método estático de conveniência para uso direto
     * @param {string} taskId - ID da tarefa
     * @param {string} content - Conteúdo do comentário
     * @param {string} userId - ID do usuário (opcional)
     * @returns {Promise<Object>} Resultado da operação
     */
    static addComment(taskId: any, content: any, userId?: any): Promise<any>;
}
