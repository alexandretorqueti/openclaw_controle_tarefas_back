/**
 * Utilitários para gerenciamento de sessões em cadeias de dependências
 *
 * Regras:
 * 1. Se uma tarefa não tem dependência, cria a sessão com o id daquela tarefa
 * 2. Se uma tarefa é dependente de outra, ela precisa entrar na sessão da anterior
 * 3. Se uma tarefa é dependente de uma que é dependente de outra, deve pegar a sessão da primeira
 * 4. Sempre que uma tarefa for dependente de qualquer uma, deve-se procurar a PRIMEIRA tarefa da fila
 */
declare const prisma: any;
declare class SessionChainUtils {
    /**
     * Encontra a PRIMEIRA tarefa da cadeia de dependências
     * @param {string} taskId - ID da tarefa atual
     * @returns {Promise<string>} ID da primeira tarefa da cadeia
     */
    static findFirstTaskInChain(taskId: any): Promise<any>;
    /**
     * Gera um ID de sessão baseado na primeira tarefa da cadeia
     * @param {string} taskId - ID da tarefa atual
     * @param {string} sessionType - Tipo de sessão ('arquiteto' ou 'turno')
     * @param {number} turnNumber - Número do turno (apenas para sessões de turno)
     * @returns {Promise<string>} ID da sessão unificada
     */
    static generateUnifiedSessionId(taskId: any, sessionType: any, turnNumber?: any): Promise<string>;
    /**
     * Verifica se uma tarefa tem dependências BLOCKING não finalizadas
     * @param {string} taskId - ID da tarefa
     * @returns {Promise<boolean>} true se tem dependências pendentes
     */
    static hasPendingDependencies(taskId: any): Promise<any>;
    /**
     * Obtém todas as tarefas na mesma cadeia de dependências
     * @param {string} taskId - ID da tarefa atual
     * @returns {Promise<Array>} Lista de tarefas na cadeia (da primeira até a atual)
     */
    static getTaskChain(taskId: any): Promise<any[]>;
}
