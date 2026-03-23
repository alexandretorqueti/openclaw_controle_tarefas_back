/**
 * Serviço de notificações para Telegram via OpenClaw
 */
declare const exec: any;
declare const util: any;
declare const execAsync: any;
declare class NotificationService {
    /**
     * Envia uma notificação no Telegram
     * @param {string} message - Mensagem a ser enviada
     * @param {string} chatId - ID do chat (opcional, usa default se não informado)
     * @returns {Promise<boolean>} true se enviado com sucesso
     */
    static sendTelegramNotification(message: any, chatId?: any): Promise<boolean>;
    /**
     * Método fallback para enviar notificação (usando curl ou outro método)
     * @param {string} message - Mensagem a ser enviada
     * @param {string} chatId - ID do chat
     * @returns {Promise<boolean>} true se enviado com sucesso
     */
    static sendTelegramNotificationFallback(message: any, chatId?: any): Promise<boolean>;
    /**
     * Envia notificação quando uma tarefa é concluída
     * @param {Object} task - Objeto da tarefa
     * @param {Object} user - Usuário que finalizou a tarefa
     * @param {string} executionNotes - Notas de execução (opcional)
     * @returns {Promise<boolean>} true se notificação enviada
     */
    static sendTaskCompletedNotification(task: any, user: any, executionNotes?: any): Promise<boolean>;
    /**
     * Envia notificação quando uma tarefa pai é automaticamente finalizada
     * @param {Object} parentTask - Tarefa pai
     * @param {Array} completedSubtasks - Lista de subtasks concluídas
     * @returns {Promise<boolean>} true se notificação enviada
     */
    static sendParentTaskAutoCompletedNotification(parentTask: any, completedSubtasks: any): Promise<boolean>;
    /**
     * Escapa caracteres especiais para shell command
     * @param {string} text - Texto a ser escapado
     * @returns {string} Texto escapado
     */
    static escapeMessage(text: any): any;
    /**
     * Testa a conexão com o Telegram
     * @returns {Promise<boolean>} true se conexão bem-sucedida
     */
    static testConnection(): Promise<boolean>;
}
