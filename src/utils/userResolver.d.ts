declare const prisma: any;
/**
 * Helper para resolver usuários por apelido (nickname) ou ID
 * Suporta múltiplos apelidos padrão configurados via environment variables
 */
declare class UserResolver {
    /**
     * Resolve um usuário a partir de nickname, ID ou apelidos padrão
     * @param {Object} options - Opções de resolução
     * @param {string} [options.nickname] - Nickname do usuário
     * @param {string} [options.userId] - ID do usuário
     * @param {string} [options.defaultNickname] - Apelido padrão para fallback
     * @returns {Promise<Object|null>} Usuário encontrado ou null
     */
    static resolveUser({ nickname, userId, defaultNickname }: {
        nickname: any;
        userId: any;
        defaultNickname?: any;
    }): Promise<any>;
    /**
     * Resolve usuário a partir de uma requisição HTTP
     * Extrai informações de headers, body e query parameters
     * @param {Object} req - Objeto de requisição Express
     * @returns {Promise<Object|null>} Usuário encontrado ou null
     */
    static resolveUserFromRequest(req: any): Promise<any>;
    /**
     * Obtém o ID do usuário padrão do sistema (alexandre ou jarbas)
     * @returns {Promise<string|null>} ID do usuário padrão ou null
     */
    static getDefaultUserId(): Promise<any>;
}
