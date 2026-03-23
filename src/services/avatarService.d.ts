declare const PrismaClient: any;
declare const fs: any;
declare const path: any;
declare const uuidv4: any;
declare const prisma: any;
declare class AvatarService {
    static AVATARS_DIR: any;
    /**
     * Inicializa o serviço (cria diretório se não existir)
     */
    static init(): Promise<void>;
    /**
     * Faz upload de avatar para um agente
     * @param {string} agentId - ID do agente
     * @param {Object} file - Objeto file do multer
     * @returns {Promise<Object>} - Informações do avatar salvo
     */
    static uploadAvatar(agentId: any, file: any): Promise<{
        success: boolean;
        avatar: any;
        avatarUrl: string;
        message: string;
    }>;
    /**
     * Obtém informações do avatar de um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<Object|null>} - Informações do avatar ou null
     */
    static getAvatar(agentId: any): Promise<any>;
    /**
     * Remove avatar de um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<boolean>} - true se removido, false se não existia
     */
    static deleteAvatar(agentId: any): Promise<boolean>;
    /**
     * Serve arquivo de avatar
     * @param {string} agentId - ID do agente
     * @param {string} filename - Nome do arquivo
     * @returns {Promise<Object>} - Informações do arquivo
     */
    static serveAvatarFile(agentId: any, filename: any): Promise<{
        buffer: any;
        mimeType: any;
        size: any;
        filename: any;
    }>;
    /**
     * Obtém URL do avatar para um agente
     * @param {string} agentId - ID do agente
     * @returns {Promise<string|null>} - URL do avatar ou null
     */
    static getAvatarUrl(agentId: any): Promise<any>;
}
