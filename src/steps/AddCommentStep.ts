// Migrado para TypeScript - Fase: Steps
// Arquivo: AddCommentStep.js

// src/steps/AddCommentStep.js
/**
 * Step responsável por adicionar comentários a tarefas.
 * Usa o container para obter todas as dependências necessárias.
 */

import container from '../container';

class AddCommentStep {
  /**
   * Construtor que obtém todas as dependências do container.
   */
  constructor() {
    (this as any).commentService = container.resolve('commentService');
    (this as any).log = container.resolve('log');
  }

  /**
   * Executa o step de adição de comentário
   * @param {Object} context - Contexto do pipeline
   * @param {string} context.taskId - ID da tarefa
   * @param {string} context.content - Conteúdo do comentário
   * @param {string} context.userId - ID do usuário (opcional, pode vir do contexto global)
   * @returns {Promise<Object>} Contexto atualizado
   */
  async execute(context): Promise<any> {
    const { taskId, content, userId } = context;
    
    if (!taskId || !content) {
      await this.log(`⚠️ AddCommentStep: taskId ou content não fornecidos`);
      return {
        ...context,
        commentResult: {
          success: false,
          error: 'taskId ou content não fornecidos'
        }
      };
    }

    try {
      await this.commentService.createComment({
        taskId,
        userId: userId || null,
        content
      });
      
      await this.log(`💬 Comentário adicionado à tarefa ${taskId}`);
      
      return {
        ...context,
        commentResult: {
          success: true,
          taskId,
          content
        }
      };
    } catch (error) {
      await this.log(`⚠️ Erro ao adicionar comentário à tarefa ${taskId}: ${error.message}`);
      
      return {
        ...context,
        commentResult: {
          success: false,
          error: error.message,
          taskId,
          content
        }
      };
    }
  }

  /**
   * Método estático de conveniência para uso direto
   * @param {string} taskId - ID da tarefa
   * @param {string} content - Conteúdo do comentário
   * @param {string} userId - ID do usuário (opcional)
   * @returns {Promise<Object>} Resultado da operação
   */
  static async addComment(taskId, content, userId = null): Promise<any> {
    const step = new AddCommentStep();
    const result = await step.execute({ taskId, content, userId });
    return result.commentResult;
  }
}

export default AddCommentStep;