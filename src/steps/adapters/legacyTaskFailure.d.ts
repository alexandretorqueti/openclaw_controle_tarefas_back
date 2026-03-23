/**
 * Adaptador para manter compatibilidade com a função handleTaskFailure original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função handleTaskFailure compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskFailure(task, error)
 */
declare function createLegacyTaskFailure(defaultUserId?: any, defaultApiUrl?: any): (task: any, error: any) => Promise<void>;
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskFailure(task, error, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
declare function handleTaskFailure(task: any, error: any, userId?: any, config?: {}): Promise<void>;
