// src/steps/AddCommentStep.ts
/**
 * Step responsável por adicionar comentários a tarefas.
 * Usa o container para obter todas as dependências necessárias.
 */

import container from '../container';

class AddCommentStep {
  // 1. Declaração explícita das propriedades (Adeus 'this as any')
  private commentService: any;
  private log: any;

  /**
   * Construtor que obtém todas as dependências do container.
   */
  constructor() {
    this.commentService = container.get('commentService');
    this.log = container.get('log');
  }

  /**
   * Executa o step de adição de comentário
   */
  async execute(context: any): Promise<any> {
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
    } catch (error: any) {
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
   */
  static async addComment(taskId: string, content: string, userId: string | null = null): Promise<any> {
    const step = new AddCommentStep();
    const result = await step.execute({ taskId, content, userId });
    return result.commentResult;
  }
}

export default AddCommentStep;