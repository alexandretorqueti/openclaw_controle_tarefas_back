/**
 * Adaptador para manter compatibilidade com a função handleTaskTimeoutCheck original.
 * Usa o container para obter todas as dependências.
 */
declare const container: any;
/**
 * Cria a função handleTaskTimeoutCheck compatível usando o container
 * @param {number} defaultTaskTimeoutMs - Timeout padrão (ex: TASK_TIMEOUT_MS)
 * @returns {Function} Função handleTaskTimeoutCheck(pid)
 */
declare function createLegacyTaskTimeoutCheck(defaultTaskTimeoutMs?: any): (pid: any) => Promise<void>;
/**
 * Função de compatibilidade direta para uso no monitor.js
 * Aceita a assinatura: handleTaskTimeoutCheck(pid, config)
 * Ignora config, usa timeout do config se fornecido
 */
declare function handleTaskTimeoutCheck(pid: any, config?: {}): Promise<void>;
