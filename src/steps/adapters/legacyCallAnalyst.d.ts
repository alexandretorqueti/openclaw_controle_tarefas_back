/**
 * Adaptador para manter compatibilidade com a função callAnalyst original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função callAnalyst compatível usando o container
 * @param {string} userId - ID do usuário para comentários
 * @returns {Function} Função callAnalyst(task)
 */
declare function createLegacyCallAnalyst(userId: any): (task: any) => Promise<{
    success: boolean;
    subtasksCreated: any;
    error?: undefined;
} | {
    success: boolean;
    error: any;
    subtasksCreated?: undefined;
}>;
