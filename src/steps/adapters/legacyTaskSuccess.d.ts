/**
 * Adaptador para manter compatibilidade com a função handleTaskSuccess original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função handleTaskSuccess compatível usando o container
 * @param {string} defaultUserId - ID do usuário padrão (ex: MY_USER_ID)
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função handleTaskSuccess(task, executionResult)
 */
declare function createLegacyTaskSuccess(defaultUserId?: any, defaultApiUrl?: any): (task: any, executionResult: any) => Promise<void>;
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskSuccess(task, executionResult, userId, config)
 * Ignora config, usa userId se fornecido, caso contrário usa padrão do container
 */
declare function handleTaskSuccess(task: any, executionResult: any, userId?: any, config?: {}): Promise<void>;
