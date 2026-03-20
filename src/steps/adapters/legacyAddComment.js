// src/steps/adapters/legacyAddComment.js
/**
 * Adaptador para manter compatibilidade com a função addComment original.
 * Usa o container para obter todas as dependências.
 */

const container = require('@/bootstrap');

/**
 * Cria a função addComment compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: UserIdJarbas)
 * @returns {Function} Função addComment(taskId, content)
 */
function createLegacyAddComment(defaultUserId = null) {
  // Importar AddCommentStep (evita circular dependency)
  const AddCommentStep = require('../AddCommentStep');
  
  // Criar instância do step (o construtor já obtém tudo do container)
  const addCommentStep = new AddCommentStep();
  
  /**
   * Função compatível com a addComment original
   * @param {string} taskId - ID da tarefa
   * @param {string} content - Conteúdo do comentário
   * @returns {Promise<void>}
   */
  return async function addComment(taskId, content) {
    try {
      await addCommentStep.execute({
        taskId,
        content,
        userId: defaultUserId
      });
      // A função original não retorna nada, apenas silencia erros
    } catch (error) {
      // Erro já foi logado pelo step, não precisamos fazer nada aqui
      // A função original apenas loga e continua
    }
  };
}

module.exports = { createLegacyAddComment };