/**
 * Adaptador para manter compatibilidade com a função addComment original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função addComment compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: UserIdJarbas)
 * @returns {Function} Função addComment(taskId, content)
 */
declare function createLegacyAddComment(defaultUserId?: any): (taskId: any, content: any) => Promise<void>;
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: addComment(taskId, content, userId)
 * Usa userId se fornecido, caso contrário usa padrão do container
 */
declare function addComment(taskId: any, content: any, userId?: any): Promise<void>;
