// src/steps/adapters/legacyAddComment.js
/**
 * Adaptador para manter compatibilidade com a função addComment original.
 * Usa o container para obter todas as dependências.
 */

const container = require('../../container');

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

/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: addComment(taskId, content, userId)
 * Usa userId se fornecido, caso contrário usa padrão do container
 */
async function addComment(taskId, content, userId = null) {
  try {
    const step = new (require('../AddCommentStep'))();
    await step.execute({
      taskId,
      content,
      userId: userId || null
    });
  } catch (error) {
    // Erro já logado pelo step
  }
}

module.exports = { createLegacyAddComment, addComment };