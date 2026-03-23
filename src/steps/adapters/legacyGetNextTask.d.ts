/**
 * Adaptador para manter compatibilidade com a função getNextEligibleTask original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função getNextEligibleTask compatível usando o container
 * @param {string} defaultApiUrl - URL da API (ex: API_URL)
 * @returns {Function} Função getNextEligibleTask(nickname)
 */
declare function createLegacyGetNextTask(defaultApiUrl?: any): (nickname: any) => Promise<any>;
